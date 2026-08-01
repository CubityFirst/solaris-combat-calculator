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

/** Shared, because it is only ever read from and never written to. */
const EMPTY_KILLS: Map<string, number> = new Map();

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
    outcomeOnly?: boolean,
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

        // Working out who gets credit for which kill costs an array, a sort
        // and a pass over every attacker, every round. Nothing reads it when
        // only the outcome is wanted.
        const killsFromGroups = outcomeOnly
            ? EMPTY_KILLS
            : allocateKillsFromDamage(
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
    outcomeOnly?: boolean,
): CombatRoundState<ID, P, S, C> => {
    let groupsWithDamage: GroupsWithDamage<ID, P, S, C>;

    groupsWithDamage = calculateIncomingDamages(
        oldState.groups,
        oldState.groups,
        outcomeOnly,
    );

    const newGroups = outcomeOnly
        ? groupsWithDamage.map(([group]) => group)
        : applyDamages(groupsWithDamage);

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

/**
 * The group-level half of `distributeDamage`, without splitting losses across
 * carriers and the star.
 *
 * The "ships needed" search only asks who was left standing, which is a
 * group-level number, but the split is the single most expensive part of
 * resolving a battle - it hands out losses one ship at a time. Skipping it
 * during probes makes each one several times cheaper and cannot change the
 * answer. The battle the user asked for is always distributed properly.
 */
const summariseGroup = <
    ID extends Id,
    P extends CombatBasePlayer<ID>,
    S extends CombatBaseStar<ID>,
    C extends CombatBaseCarrier<ID>,
>(
    group: CombatResultGrouped<ID, P, S, C>,
): DetailedCombatResultGroup<ID, P, S, C> => ({
    id: group.id,
    players: group.players,
    carriers: [],
    star: undefined,
    shipsBefore: group.shipsBefore,
    shipsLost: group.shipsLost,
    shipsAfter: group.shipsAfter,
    shipsKilled: group.shipsKilled,
    carriersKilled: 0,
    carriersLost: 0,
    specialistsKilled: 0,
    specialistsLost: 0,
    attackAgainst: mapToRecord(group.attackAgainst),
});

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
    skipDistribution?: boolean,
): DetailedCombatResult<ID, P, S, C> => {
    const groups: DetailedCombatResultGroup<ID, P, S, C>[] = state.groups.map(
        (g) => {
            const summary = {
                id: g.id,
                players: g.players,
                star: g.star,
                carriers: g.carriers,
                shipsBefore: g.originalShips,
                shipsAfter: g.ships,
                shipsLost: g.originalShips - g.ships,
                shipsKilled: g.shipsKilled,
                attackAgainst: g.attackAgainst,
            };

            return skipDistribution
                ? summariseGroup(summary)
                : distributeDamage(summary, budget);
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
    skipDistribution?: boolean,
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

        state = performCombatRound(state, isCarrierToStarCombat, skipDistribution);
    }

    return makeResult(
        state,
        initState.groups,
        isCarrierToStarCombat,
        budget,
        skipDistribution,
    );
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
 * Since the search jumps rather than walking, this is now a backstop against
 * pathological battles rather than something ordinary use runs into. It cannot
 * lift the answer above 10,001 however high it goes: the search gives up at
 * that many ships regardless, as upstream does.
 */
const ESTIMATE_WORK_BUDGET = 15_000_000;

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
 * The largest reinforcement the search will consider.
 *
 * Upstream stops at 10,001, because walking up one ship at a time makes
 * anything higher unaffordable. This search jumps, so raising the ceiling costs
 * one extra probe per doubling - roughly ten probes for a thousandfold increase
 * - and battles that used to report "more than 10,000" now get a real figure.
 * 45 against 231,231 answers 115,616 rather than throwing up its hands.
 *
 * `ESTIMATE_WORK_BUDGET` is what actually stops a runaway battle now. An answer
 * of exactly this ceiling still means "was still losing there" rather than
 * "wins with this many", and the UI says so.
 */
export const SHIPS_NEEDED_CEILING = 10_000_000;

/**
 * How many losses in a row the downward refinement needs to see before it
 * accepts that it has found the lowest winning count.
 *
 * Winning is not monotone in ship count - see the note on `estimateNeeded` - so
 * the refinement cannot stop at the first loss. It keeps going until it has
 * seen a run this long. Measured against the exact walk, the widest gap between
 * two winning counts is 2, so 8 is a wide margin; `estimate-search.spec.ts`
 * re-measures it rather than trusting this comment.
 */
const REFINE_FAIL_RUN = 8;

/**
 * How many ships a group would have needed to win, or `null` if working that
 * out would have taken too long.
 *
 * Upstream walks up one ship at a time, re-fighting the whole battle at each
 * step, and gives up after 10,001. That is quadratic in the size of the battle:
 * 45 ships against 20,000 takes 92 seconds, and against a few hundred thousand
 * it locks the page for minutes. In-game the inputs come from a real galaxy and
 * stay small; on a web form anyone can type 231231.
 *
 * So this jumps instead: probe upwards in doubling steps until the group wins,
 * binary-search the bracket for the boundary, then walk back down past it.
 *
 * The walk back down is the part that matters, because winning is *not*
 * monotone in ship count. In one recorded battle 179 ships win, 180 and 181
 * lose, and 182 wins again - a nearly-dead defender fires for `ships +
 * defenderBonus` under the damage clamp, which can beat what it would do at
 * full strength. Stopping at the first loss would answer 182 where upstream
 * answers 179. Refinement therefore continues until it has seen
 * `REFINE_FAIL_RUN` losses in a row.
 *
 * That leaves one way to differ from upstream: a winning count sitting alone
 * below a gap wider than the run. No such gap has been found - the widest
 * measured is 2 - but it is not impossible, so this is an estimate that agrees
 * with the game everywhere it has been checked, rather than a proof.
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

    const target = originalGroups.find((gr) => gr.id === estimateForGroup.id);

    // Captured before any probe runs. Upstream reassigns into the shared
    // `carriers` array as it walks, so each step inflates the next one's
    // carrier ships; that never reaches the win/lose decision, which reads
    // group-level ships, but it does make the outcome depend on the order the
    // probes were made - and these are not made in order.
    const baseStarShips = target?.star?.ships ?? 0;
    const baseCarrierShips = target?.carriers?.[0]?.ships ?? 0;

    const winsWith = (shipsNeeded: number): boolean => {
        const extra = shipsNeeded - originalShips;

        const modifiedGroups = originalGroups.map((gr) => {
            if (gr.id !== estimateForGroup.id) {
                return gr;
            }

            const newGr = {
                ...gr,
                originalShips: shipsNeeded,
                ships: shipsNeeded,
                shipsKilled: 0,
            };

            if (newGr.star) {
                newGr.star = { ...newGr.star, ships: baseStarShips + extra };
            } else {
                newGr.carriers = [...newGr.carriers];
                newGr.carriers[0] = {
                    ...newGr.carriers[0],
                    ships: baseCarrierShips + extra,
                };
            }

            return newGr;
        });

        const newResult = combatLoop(
            { round: 0, groups: modifiedGroups },
            combatResult.isCarrierToStarCombat,
            undefined,
            budget,
            true, // only the outcome is wanted, not the per-object split
        );

        const groupInNew = newResult.groups.find(
            (g) => g.id === estimateForGroup.id,
        );

        if (terminationCondition === "greaterThanZeroShips") {
            return groupInNew!.shipsAfter > 0;
        }

        return newResult.groups
            .filter((g) => g != groupInNew!)
            .every((g) => g.shipsAfter === 0);
    };

    const lowest = originalShips + 1;

    // Upstream stops after 10,001 tries, but always makes at least one - so for
    // a group already bigger than the ceiling, that single try is the search.
    const ceiling = Math.max(SHIPS_NEEDED_CEILING, lowest);

    try {
        // Jump: lowest, +1, +3, +7, ... until something wins.
        let lastLoss = lowest - 1;
        let firstWin = -1;
        let probe = lowest;
        let delta = 1;

        while (true) {
            if (winsWith(probe)) {
                firstWin = probe;
                break;
            }

            lastLoss = probe;

            if (probe >= ceiling) {
                break;
            }

            delta *= 2;
            probe = Math.min(ceiling, lowest + delta - 1);
        }

        if (firstWin === -1) {
            return ceiling;
        }

        // Narrow the bracket to the boundary of the winning run.
        let low = lastLoss + 1;
        let high = firstWin;

        while (low < high) {
            const mid = low + Math.floor((high - low) / 2);

            if (winsWith(mid)) {
                high = mid;
            } else {
                low = mid + 1;
            }
        }

        let best = low;

        // Then step back down through any gaps below it.
        let lossRun = 0;

        for (let n = best - 1; n >= lowest && lossRun < REFINE_FAIL_RUN; n--) {
            if (winsWith(n)) {
                best = n;
                lossRun = 0;
            } else {
                lossRun++;
            }
        }

        return best;
    } catch (e) {
        if (e instanceof WorkBudgetExhausted) {
            return null;
        }

        throw e;
    }
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
