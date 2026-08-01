// Ported from solaris-games/solaris (GPL-3.0-or-later): common/src/services/combat.ts
//
// The combat resolution itself is unchanged. What was removed: `computeStar`,
// `computeCarrier`, `_makeGroups`, `_createGroup`, `getDefenderDetailed` and the
// `CombatGroupService` dependency -- all of those exist to turn a live galaxy
// (players, diplomacy, orbiting carriers) into combat groups, which the
// standalone calculator builds from form inputs instead. Every code path the
// calculator actually exercises is byte-for-byte upstream.
import type { Id } from "../types/id";
import type { Game } from "../types/game";
import { TechnologyService, type WeaponsDetail } from "./technology";
import type { ISpecialistService } from "./specialist";
import type {
    BasicCombatResult,
    CombatBaseCarrier,
    CombatBasePlayer,
    CombatBaseStar,
    CombatGroup,
    DetailedCombatResult,
    DetailedCombatResultCarrier,
    DetailedCombatResultGroup,
    DetailedCombatResultStar,
} from "../types/combat";

type CombatRoundState<
    ID,
    P extends CombatBasePlayer<ID>,
    S extends CombatBaseStar<ID>,
    C extends CombatBaseCarrier<ID>,
> = {
    round: number;
    groups: CombatGroup<ID, P, S, C>[];
};

type MO<ID, S extends CombatBaseStar<ID>, C extends CombatBaseCarrier<ID>> =
    | { type: "carrier"; carrier: DetailedCombatResultCarrier<ID, C> }
    | {
          type: "star";
          star: DetailedCombatResultStar<ID, S>;
      };

type CombatResultGrouped<
    ID,
    P extends CombatBasePlayer<ID>,
    S extends CombatBaseStar<ID>,
    C extends CombatBaseCarrier<ID>,
> = {
    id: string;
    players: P[];
    carriers: C[];
    star: S | undefined;
    attackAgainst: Map<number, WeaponsDetail>;
    shipsKilled: number;
    shipsBefore: number;
    shipsAfter: number;
    shipsLost: number;
};

type BasicSideSpec = {
    ships: number;
    weaponsLevel: number;
};

type GroupsWithDamage<
    ID extends Id,
    P extends CombatBasePlayer<ID>,
    S extends CombatBaseStar<ID>,
    C extends CombatBaseCarrier<ID>,
> = [CombatGroup<ID, P, S, C>, Map<string, number>][];

//This is specifically for crediting ship kills:
// -proportionally to raw damage when incoming damage exceeds the target's remaining ships.
// -remainder handling ensures total credited kills equals actual ships destroyed.
const allocateKillsFromDamage = (
    damageFromGroups: Map<string, number>,
    totalDamage: number,
    shipsActuallyDestroyed: number,
): Map<string, number> => {
    const killsFromGroups = new Map<string, number>();

    // Nothing was damaged/killed. Return zero kill credit for each attacker.
    if (totalDamage <= 0 || shipsActuallyDestroyed <= 0) {
        damageFromGroups.forEach((_, groupId) => {
            killsFromGroups.set(groupId, 0);
        });

        return killsFromGroups;
    }

    //1) distribute credit for kills fairly between groups based on the proportion of damage they did this round.
    //  Count up how many fractional kills are un-credited as "remainder".
    //Example:
    //  Target loses 5 ships.
    //  Group A did 8 of 16 total damage -> exactKills = 2.5
    //  Group B did 8 of 16 total damage -> exactKills = 2.5
    const killShares = Array.from(damageFromGroups.entries()).map(
        ([groupId, damage]) => {
            const exactKills = (damage / totalDamage) * shipsActuallyDestroyed;

            const flooredKills = Math.floor(exactKills);

            return {
                groupId,
                flooredKills,

                remainder: exactKills - flooredKills,
            };
        },
    );

    //2) Assign fractional kills which were dropped on the floor()
    //Give leftover kills to the groups with the largest fractional remainders.
    //Ties are deterministic based on the existing Map insertion order.
    //Example:
    //  2.5 + 2.5 floors to 2 + 2 = 4,
    //  but 5 ships were actually destroyed,
    //  so 1 leftover kill still needs to be assigned.
    let killsRemaining =
        shipsActuallyDestroyed -
        killShares.reduce((sum, share) => sum + share.flooredKills, 0);

    killShares
        .sort((a, b) => b.remainder - a.remainder)
        .forEach((share) => {
            const extraKill = killsRemaining > 0 ? 1 : 0;

            killsFromGroups.set(share.groupId, share.flooredKills + extraKill);

            killsRemaining -= extraKill;
        });

    return killsFromGroups;
};

const calculateIncomingDamages = <
    ID extends Id,
    P extends CombatBasePlayer<ID>,
    S extends CombatBaseStar<ID>,
    C extends CombatBaseCarrier<ID>,
>(
    groups: CombatGroup<ID, P, S, C>[],
    attackingGroups: CombatGroup<ID, P, S, C>[],
): GroupsWithDamage<ID, P, S, C> => {
    return groups.map((group, groupIdx) => {
        const damageFromGroups = new Map<string, number>();
        let totalDamage = 0;

        attackingGroups.forEach((otherGroup) => {
            if (group.id === otherGroup.id) {
                return;
            }

            const dmgFromOther = otherGroup.attackAgainst.get(groupIdx)!;

            const otherIsDefender = otherGroup.isDefender;

            let damage;
            if (otherGroup.ships < dmgFromOther.total) {
                // clamp damage
                // if the other group is the defender, we apply the defender bonus anyway
                if (otherIsDefender) {
                    damage = otherGroup.ships + (dmgFromOther.defenderBonus || 0);
                } else {
                    damage = otherGroup.ships;
                }
            } else {
                damage = dmgFromOther.total;
            }

            damageFromGroups.set(otherGroup.id, damage);
            totalDamage += damage;
        });

        const shipsAfterDamage = Math.max(0, group.ships - totalDamage);
        const shipsActuallyDestroyed = group.ships - shipsAfterDamage; //in case damage > ships remaining, shipsDestroyed is the accurate number in order to credit kills for

        const killsFromGroups = allocateKillsFromDamage(
            damageFromGroups,
            totalDamage,
            shipsActuallyDestroyed,
        );

        return [
            {
                ...group,
                ships: shipsAfterDamage,
            },
            killsFromGroups, //credit for shipKills distributed among groups doing damage, not to exceed actual # of ships killed.
        ];
    });
};

const applyDamages = <
    ID extends Id,
    P extends CombatBasePlayer<ID>,
    S extends CombatBaseStar<ID>,
    C extends CombatBaseCarrier<ID>,
>(
    groupsWithDamage: GroupsWithDamage<ID, P, S, C>,
) => {
    return groupsWithDamage.map(([group, _]) => {
        const damageDoneList = groupsWithDamage.map(
            ([_, dd]) => dd.get(group.id) || 0,
        );

        const damageDone = damageDoneList.reduce((sum, d) => sum + d, 0);

        return {
            ...group,
            shipsKilled: group.shipsKilled + damageDone,
        };
    });
};

const performCombatRound = <
    ID extends Id,
    P extends CombatBasePlayer<ID>,
    S extends CombatBaseStar<ID>,
    C extends CombatBaseCarrier<ID>,
>(
    oldState: CombatRoundState<ID, P, S, C>,
    isCarrierToStarCombat: boolean,
): CombatRoundState<ID, P, S, C> => {
    let groupsWithDamage: GroupsWithDamage<ID, P, S, C>;

    groupsWithDamage = calculateIncomingDamages(oldState.groups, oldState.groups);

    const newGroups = applyDamages(groupsWithDamage);

    return {
        round: oldState.round + 1,
        groups: newGroups,
    };
};

const mapToRecord = (
    map: Map<number, WeaponsDetail>,
): Record<string, WeaponsDetail> => {
    const obj: Record<number, WeaponsDetail> = {};

    for (let [k, v] of map) {
        obj[k] = v;
    }

    return obj;
};

const distributeDamage = <
    ID extends Id,
    P extends CombatBasePlayer<ID>,
    S extends CombatBaseStar<ID>,
    C extends CombatBaseCarrier<ID>,
>(
    group: CombatResultGrouped<ID, P, S, C>,
    budget?: WorkBudget,
): DetailedCombatResultGroup<ID, P, S, C> => {
    // Losses are handed out one ship at a time below, so a large battle costs
    // as much here as in the round loop.
    spend(budget, group.shipsLost);

    const getShips = (obj: MO<ID, S, C>) => {
        if (obj.type === "carrier") {
            return obj.carrier.shipsAfter;
        } else {
            return obj.star.shipsAfter;
        }
    };

    let shipsToKill = group.shipsLost;

    const groupObjects: MO<ID, S, C>[] = group.carriers.map((carrier) => {
        return {
            type: "carrier",
            carrier: {
                carrier,
                shipsBefore: carrier.ships || 0,
                shipsLost: 0,
                shipsAfter: carrier.ships || 0,
            },
        };
    });

    if (group.star) {
        groupObjects.push({
            type: "star",
            star: {
                star: group.star,
                shipsBefore: group.star.ships || 0,
                shipsLost: 0,
                shipsAfter: group.star.ships || 0,
            },
        });
    }

    groupObjects.sort((a, b) => {
        const specsIdA =
            a.type === "carrier"
                ? a.carrier.carrier.specialistId
                : a.star.star.specialistId;
        const specsIdB =
            b.type === "carrier"
                ? b.carrier.carrier.specialistId
                : b.star.star.specialistId;

        // Sort by specialist (kill objects without specialists first)
        if (specsIdA == null && specsIdB != null) {
            return -1;
        } else if (specsIdA != null && specsIdB == null) {
            return 1;
        }

        const shipsA = getShips(a);
        const shipsB = getShips(b);

        // Sort by ships descending (kill objects with the most ships first)
        if (shipsA > shipsB) return -1;
        if (shipsA < shipsB) return 1;

        return 0; // Both are the same.
    });

    const shipValues = groupObjects.map(getShips);
    const objCount = shipValues.length;

    let nextIdx = 0;

    while (shipsToKill > 0) {
        if (shipValues[nextIdx] > 0) {
            shipsToKill--;
            shipValues[nextIdx] = shipValues[nextIdx] - 1;
            nextIdx = (nextIdx + 1) % objCount;
        } else {
            nextIdx = (nextIdx + 1) % objCount;

            if (shipValues.every((v) => v === 0)) {
                throw new Error(
                    `Objects are all at 0 but shipsToKill is ${shipsToKill}`,
                ); // should not ever happen but just to avoid the endless loop...
            }
        }
    }

    const setShips = (ships: number, obj: MO<ID, S, C>) => {
        if (obj.type === "star") {
            const before = obj.star.shipsBefore;
            obj.star.shipsLost = before - ships;
            obj.star.shipsAfter = ships;
        } else if (obj.type === "carrier") {
            const before = obj.carrier.shipsBefore;
            obj.carrier.shipsLost = before - ships;
            obj.carrier.shipsAfter = ships;
        }
    };

    // write back ships after kills were deducted
    for (let i = 0; i < shipValues.length; i++) {
        setShips(shipValues[i], groupObjects[i]);
    }

    const carriersLost = groupObjects.filter(
        (c) => c.type === "carrier" && c.carrier.shipsAfter <= 0,
    );

    const specialistsLost = groupObjects.filter(
        (c) =>
            c.type === "carrier" &&
            c.carrier.shipsAfter <= 0 &&
            c.carrier.carrier.specialistId &&
            c.carrier.carrier.specialistId !== 0,
    );

    const carriersRes = groupObjects.flatMap((o) => {
        if (o.type === "carrier") {
            return [o.carrier];
        } else {
            return [];
        }
    });

    const starRes = groupObjects.find((o) => o.type === "star")?.star;

    return {
        id: group.id,
        players: group.players,
        carriers: carriersRes,
        star: starRes,
        shipsBefore: group.shipsBefore,
        shipsLost: group.shipsLost,
        shipsAfter: group.shipsAfter,
        shipsKilled: group.shipsKilled,
        carriersKilled: 0, // backfilled later
        carriersLost: carriersLost.length,
        specialistsKilled: 0, // backfilled later
        specialistsLost: specialistsLost.length,
        attackAgainst: mapToRecord(group.attackAgainst),
    };
};

const computeKills = <
    ID extends Id,
    P extends CombatBasePlayer<ID>,
    S extends CombatBaseStar<ID>,
    C extends CombatBaseCarrier<ID>,
>(
    groups: DetailedCombatResultGroup<ID, P, S, C>[],
) => {
    const otherGroupsCount = groups.length - 1;

    for (let i = 0; i < groups.length; i++) {
        const group = groups[i];
        const carriersKilledInOtherGroups = groups
            .map((og, oI) => {
                if (oI === i) {
                    return 0;
                } else {
                    return og.carriersKilled;
                }
            })
            .reduce((sum, c) => sum + c, 0);

        const specialistsKilledInOtherGroups = groups
            .map((og, oI) => {
                if (oI === i) {
                    return 0;
                } else {
                    return og.specialistsKilled;
                }
            })
            .reduce((sum, c) => sum + c, 0);

        group.carriersKilled = Math.floor(
            carriersKilledInOtherGroups / otherGroupsCount,
        );
        group.specialistsKilled = Math.floor(
            specialistsKilledInOtherGroups / otherGroupsCount,
        );
    }
};

const makeResult = <
    ID extends Id,
    P extends CombatBasePlayer<ID>,
    S extends CombatBaseStar<ID>,
    C extends CombatBaseCarrier<ID>,
>(
    state: CombatRoundState<ID, P, S, C>,
    originalCombatGroups: CombatGroup<ID, P, S, C>[],
    isCarrierToStarCombat: boolean,
    budget?: WorkBudget,
): DetailedCombatResult<ID, P, S, C> => {
    const groups: DetailedCombatResultGroup<ID, P, S, C>[] = state.groups.map(
        (g) => {
            return distributeDamage(
                {
                id: g.id,
                players: g.players,
                star: g.star,
                carriers: g.carriers,
                shipsBefore: g.originalShips,
                shipsAfter: g.ships,
                shipsLost: g.originalShips - g.ships,
                shipsKilled: g.shipsKilled,
                attackAgainst: g.attackAgainst,
                },
                budget,
            );
        },
    );

    computeKills(groups);

    return {
        combatGroups: originalCombatGroups,
        isCarrierToStarCombat,
        groups,
    };
};

const isCombatOver = <
    ID extends Id,
    P extends CombatBasePlayer<ID>,
    S extends CombatBaseStar<ID>,
    C extends CombatBaseCarrier<ID>,
>(
    state: CombatRoundState<ID, P, S, C>,
) => {
    return state.groups.filter((g) => g.ships > 0).length <= 1; // mutual destruction is possible
};

const combatLoop = <
    ID extends Id,
    P extends CombatBasePlayer<ID>,
    S extends CombatBaseStar<ID>,
    C extends CombatBaseCarrier<ID>,
>(
    initState: CombatRoundState<ID, P, S, C>,
    isCarrierToStarCombat: boolean,
    callback?: (st: CombatRoundState<ID, P, S, C>) => void,
    budget?: WorkBudget,
): DetailedCombatResult<ID, P, S, C> => {
    let state = initState;

    while (true) {
        if (callback) {
            callback(state);
        }

        // check for dead
        if (isCombatOver(state)) {
            break;
        }

        // Only the "ships needed" search passes a budget. The battle the user
        // actually asked for is always fought to the end.
        spend(budget, 1);

        state = performCombatRound(state, isCarrierToStarCombat);
    }

    return makeResult(state, initState.groups, isCarrierToStarCombat, budget);
};

const findGroupDetailed = <
    ID extends Id,
    P extends CombatBasePlayer<ID>,
    S extends CombatBaseStar<ID>,
    C extends CombatBaseCarrier<ID>,
>(
    result: DetailedCombatResult<ID, P, S, C>,
    playerId: ID,
) => {
    return result.groups.find((g) =>
        g.players.find((p) => p._id.toString() === playerId.toString()),
    );
};

/**
 * Work allowed for a single `estimateNeeded` call, in simulated combat rounds
 * plus ships distributed. Worst case is a bit over a second.
 *
 * The search itself has to stay exactly as upstream wrote it - see the note on
 * `estimateNeeded` - so the only way to stop a large battle locking the page is
 * to stop searching. Counting work rather than watching the clock keeps the
 * answer the same on every machine.
 *
 * Raising this buys answers for bigger battles at a linear cost in the worst
 * case. Note that it cannot lift the answer above 10,001 however high it goes:
 * the search gives up at that many ships regardless, as upstream does.
 */
const ESTIMATE_WORK_BUDGET = 3_000_000;

type WorkBudget = { remaining: number };

/** Thrown internally when an estimate runs out of budget. Never escapes. */
class WorkBudgetExhausted extends Error {}

const spend = (budget: WorkBudget | undefined, amount: number) => {
    if (!budget) {
        return;
    }

    budget.remaining -= amount;

    if (budget.remaining <= 0) {
        throw new WorkBudgetExhausted();
    }
};

/**
 * How many ships a group would have needed to win, or `null` if working that
 * out would have taken too long.
 *
 * The search is upstream's, unchanged: walk up one ship at a time, re-fighting
 * the whole battle at each step, and give up after 10,001. It cannot be
 * replaced with a binary search, however tempting - winning is *not* monotone
 * in ship count. In one of the recorded parity battles 179 ships win, 180 and
 * 181 lose, and 182 wins again, because the damage clamp and the kill-rounding
 * make the outcome jump around. A binary search returns 182 there; upstream,
 * and this, return 179.
 *
 * What is new is the budget. The walk is quadratic in the size of the battle -
 * 45 ships against 20,000 takes 92 seconds, and against a few hundred thousand
 * it locks the page for minutes. In-game the inputs come from a real galaxy and
 * stay small; on a web form anyone can type 231231. So the walk now gives up
 * once it has done `ESTIMATE_WORK_BUDGET` work, and the caller reports that it
 * could not be determined rather than showing a number that was never reached.
 */
const estimateNeeded = <
    ID extends Id,
    P extends CombatBasePlayer<ID>,
    S extends CombatBaseStar<ID>,
    C extends CombatBaseCarrier<ID>,
>(
    combatResult: DetailedCombatResult<ID, P, S, C>,
    estimateForGroup: DetailedCombatResultGroup<ID, P, S, C>,
    originalGroups: CombatGroup<ID, P, S, C>[],
    terminationCondition:
        | "greaterThanZeroShips"
        | "eliminateOtherGroups" = "greaterThanZeroShips",
): number | null => {
    const originalShips = estimateForGroup.shipsBefore;

    if (estimateForGroup.shipsAfter > 0) {
        return originalShips;
    }

    const budget: WorkBudget = { remaining: ESTIMATE_WORK_BUDGET };

    let shipsNeeded = originalShips + 1;

    try {
        while (true) {
            const modifiedGroups = originalGroups.map((gr) => {
                if (gr.id === estimateForGroup.id) {
                    const newGr = {
                        ...gr,
                        originalShips: shipsNeeded,
                        ships: shipsNeeded,
                        shipsKilled: 0,
                    };
                    if (newGr.star) {
                        newGr.star = {
                            ...newGr.star,
                            ships:
                                newGr.star.ships! +
                                (shipsNeeded - originalShips),
                        };
                    } else {
                        newGr.carriers[0] = {
                            ...newGr.carriers[0],
                            ships:
                                newGr.carriers[0].ships! +
                                (shipsNeeded - originalShips),
                        };
                    }
                    return newGr;
                } else {
                    return gr;
                }
            });

            const newResult = combatLoop(
                { round: 0, groups: modifiedGroups },
                combatResult.isCarrierToStarCombat,
                undefined,
                budget,
            );

            const groupInNew = newResult.groups.find(
                (g) => g.id === estimateForGroup.id,
            );

            if (terminationCondition === "greaterThanZeroShips") {
                if (groupInNew!.shipsAfter > 0) {
                    break;
                }
            } else if (terminationCondition === "eliminateOtherGroups") {
                const otherGroups = newResult.groups.filter(
                    (g) => g != groupInNew!,
                );
                if (otherGroups.every((g) => g.shipsAfter === 0)) {
                    break;
                }
            }

            if (shipsNeeded > 10000) {
                break;
            }

            shipsNeeded++;
        }
    } catch (e) {
        if (e instanceof WorkBudgetExhausted) {
            return null;
        }

        throw e;
    }

    return shipsNeeded;
};

export class CombatService<ID extends Id> {
    technologyService: TechnologyService;
    specialistService: ISpecialistService;

    constructor(
        technologyService: TechnologyService,
        specialistService: ISpecialistService,
    ) {
        this.technologyService = technologyService;
        this.specialistService = specialistService;
    }

    computeGroupWeapons<
        P extends CombatBasePlayer<ID>,
        S extends CombatBaseStar<ID>,
        C extends CombatBaseCarrier<ID>,
    >(
        game: Game,
        groups: CombatGroup<ID, P, S, C>[],
        isCarrierToStarCombat: boolean,
    ) {
        this._sortGroups(groups);

        // siege breaker should apply a weapons bonus against ALL groups which contain a player that was targeted at launch

        for (let groupIdx = 0; groupIdx < groups.length; groupIdx++) {
            const group = groups[groupIdx];

            for (
                let otherGroupIdx = 0;
                otherGroupIdx < groups.length;
                otherGroupIdx++
            ) {
                const otherGroup = groups[otherGroupIdx];

                if (group.id === otherGroup.id) {
                    continue;
                }

                const weps = this.technologyService.getEffectiveWeaponsDetail(
                    game,
                    group,
                    otherGroup,
                    isCarrierToStarCombat,
                );

                group.attackAgainst.set(otherGroupIdx, weps);
            }
        }
    }

    getWinnerDetailed<
        P extends CombatBasePlayer<ID>,
        S extends CombatBaseStar<ID>,
        C extends CombatBaseCarrier<ID>,
    >(combatResult: DetailedCombatResult<ID, P, S, C>) {
        const isC2S = Boolean(combatResult.groups.find((g) => g.star));

        const nonZeroGroup = combatResult.groups.find(
            (g) => (typeof g.shipsAfter === "number" ? g.shipsAfter : 1) > 0,
        ); // if result is masked it is non-zero

        if (isC2S && !nonZeroGroup) {
            return combatResult.groups.find((g) => g.star);
        }

        return nonZeroGroup;
    }

    estimateNeeded<
        ID extends Id,
        P extends CombatBasePlayer<ID>,
        S extends CombatBaseStar<ID>,
        C extends CombatBaseCarrier<ID>,
    >(
        combatResult: DetailedCombatResult<ID, P, S, C>,
        estimateForGroup: DetailedCombatResultGroup<ID, P, S, C>,
        terminationCondition:
            | "greaterThanZeroShips"
            | "eliminateOtherGroups" = "greaterThanZeroShips",
    ) {
        return estimateNeeded(
            combatResult,
            estimateForGroup,
            combatResult.combatGroups,
            terminationCondition,
        );
    }

    calculateBasic(
        defender: BasicSideSpec,
        attacker: BasicSideSpec,
        isCarrierToStarCombat: boolean,
        includeDefenderBonus: boolean,
    ): BasicCombatResult {
        const attackMap = (
            group: number,
            level: number,
            defenderBonus: number,
        ) => {
            const m = new Map<number, WeaponsDetail>();
            m.set(group, {
                total: level + defenderBonus,
                appliedBuffs: [],
                weaponsBuff: 0,
                weaponsLevel: level,
                defenderBonus,
            });
            return m;
        };

        const carrierGroup = (
            id: string,
            weapons: number,
            ships: number,
            ownId: number,
        ) => {
            return {
                id,
                players: [
                    {
                        _id: id,
                        research: {
                            weapons: {
                                level: weapons,
                            },
                        },
                    },
                ],
                originalShips: ships,
                ships,
                isDefender: false,
                carriers: [
                    {
                        _id: "attackerCarrier",
                        ships,
                        specialistId: null,
                        ownedByPlayerId: id,
                        specialistTargetedPlayers: [],
                    },
                ],
                star: undefined,
                shipsKilled: 0,
                attackAgainst: attackMap(ownId === 0 ? 1 : 0, weapons, 0),
            };
        };

        const starGroup = (id: string, weapons: number, ships: number) => {
            return {
                id,
                players: [
                    {
                        _id: id,
                        research: {
                            weapons: {
                                level: weapons,
                            },
                        },
                    },
                ],
                originalShips: ships,
                ships,
                isDefender: true,
                carriers: [],
                star: {
                    _id: "star",
                    ships,
                    specialistId: null,
                    ownedByPlayerId: id,
                    homeStar: false,
                    isAsteroidField: false,
                },
                shipsKilled: 0,
                attackAgainst: attackMap(1, weapons, includeDefenderBonus ? 1 : 0),
            };
        };

        let groups: CombatGroup<
            string,
            CombatBasePlayer<string>,
            CombatBaseStar<string>,
            CombatBaseCarrier<string>
        >[];

        if (isCarrierToStarCombat) {
            groups = [
                starGroup("defender", defender.weaponsLevel, defender.ships),
                carrierGroup("attacker", attacker.weaponsLevel, attacker.ships, 1),
            ];
        } else {
            groups = [
                carrierGroup("defender", defender.weaponsLevel, defender.ships, 0),
                carrierGroup("attacker", attacker.weaponsLevel, attacker.ships, 1),
            ];
        }

        const result: DetailedCombatResult<
            string,
            CombatBasePlayer<string>,
            CombatBaseStar<string>,
            CombatBaseCarrier<string>
        > = combatLoop(
            {
                round: 0,
                groups,
            },
            isCarrierToStarCombat,
        );

        const defenderGroup = findGroupDetailed(result, "defender")!;
        const attackerGroup = findGroupDetailed(result, "attacker")!;

        const attackerWon = attackerGroup.shipsAfter > defenderGroup.shipsAfter;

        const defenderNeeded = attackerWon
            ? estimateNeeded(result, defenderGroup, groups, "eliminateOtherGroups")
            : undefined;
        const attackerNeeded = attackerWon
            ? undefined
            : estimateNeeded(result, attackerGroup, groups, "greaterThanZeroShips");

        return {
            defender: {
                shipsBefore: defenderGroup.shipsBefore,
                shipsAfter: defenderGroup.shipsAfter,
                shipsLost: defenderGroup.shipsLost,
                shipsNeeded: defenderNeeded,
            },
            attacker: {
                shipsBefore: attackerGroup.shipsBefore,
                shipsAfter: attackerGroup.shipsAfter,
                shipsLost: attackerGroup.shipsLost,
                shipsNeeded: attackerNeeded,
            },
        };
    }

    calculateGroups<
        P extends CombatBasePlayer<ID>,
        S extends CombatBaseStar<ID>,
        C extends CombatBaseCarrier<ID>,
    >(
        groups: CombatGroup<ID, P, S, C>[],
        isCarrierToStarCombat: boolean,
        callback?: (st: CombatRoundState<ID, P, S, C>) => void,
    ) {
        return combatLoop<ID, P, S, C>(
            { round: 0, groups },
            isCarrierToStarCombat,
            callback,
        );
    }

    private _sortGroups<
        P extends CombatBasePlayer<ID>,
        S extends CombatBaseStar<ID>,
        C extends CombatBaseCarrier<ID>,
    >(groups: CombatGroup<ID, P, S, C>[]) {
        groups.sort((g1, g2) => {
            if (g1.isDefender) {
                return -1;
            }

            if (g2.isDefender) {
                return 1;
            }

            return g2.originalShips - g1.originalShips;
        });
    }
}
