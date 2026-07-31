// Ported from solaris-games/solaris (GPL-3.0-or-later): common/src/services/technology.ts
//
// Only the weapons/combat half of the service is kept -- research costs and
// effective-tech-level lookups need a live galaxy and play no part in the
// calculator. The retained methods are byte-for-byte the upstream logic, with
// the generic `Game<ID>` narrowed to the calculator's cut-down `Game`.
import type { Id } from "../types/id";
import type { Game } from "../types/game";
import { maxBy, maxOf, minOf, notUndefined } from "../utilities/utils";
import type { GameTypeService } from "./gameType";
import type { ISpecialistService } from "./specialist";
import type {
    CombatBaseCarrier,
    CombatBasePlayer,
    CombatBaseStar,
    CombatGroup,
} from "../types/combat";

export type Buff = {
    kind: "star" | "carrier";
    amount: number;
    specialistId: number;
};

export type WeaponsDetail = {
    total: number;
    appliedBuffs: Buff[];
    weaponsBuff: number;
    weaponsLevel: number;
    defenderBonus?: number;
};

export class TechnologyService {
    specialistService: ISpecialistService;
    gameTypeService: GameTypeService;

    constructor(
        specialistService: ISpecialistService,
        gameTypeService: GameTypeService,
    ) {
        this.specialistService = specialistService;
        this.gameTypeService = gameTypeService;
    }

    _getStarWeaponsBuff<ID>(star: CombatBaseStar<ID>): Buff | undefined {
        if (star.specialistId) {
            const specialist = this.specialistService.getByIdStar(
                star.specialistId,
            );

            if (specialist && specialist.modifiers.local != null) {
                return {
                    amount: specialist.modifiers.local.weapons || 0,
                    specialistId: specialist.id,
                    kind: "star",
                };
            }
        }

        return undefined;
    }

    _getCarrierWeaponsBuff<ID extends Id>(
        carrier: CombatBaseCarrier<ID>,
        isCarrierToStarCombat: boolean,
        isDefender: boolean,
        opponentIsDefender: boolean,
        allyCount: number,
        targetedPlayers: ID[],
    ): Buff | undefined {
        if (!carrier.specialistId) {
            return undefined;
        }

        const buffs: number[] = [];
        const specialist = this.specialistService.getByIdCarrier(
            carrier.specialistId,
        );

        const isAttacker = !isDefender;

        if (!specialist) {
            return undefined;
        }

        if (specialist.modifiers.local) {
            if (
                isCarrierToStarCombat &&
                specialist.modifiers.local.carrierToStarCombat
            ) {
                if (
                    isAttacker &&
                    specialist.modifiers.local.carrierToStarCombat.attacker
                        ?.weapons
                ) {
                    if (
                        specialist.modifiers.local?.carrierToStarCombat
                            ?.captureTargetedPlayers
                    ) {
                        // apply buff when either: against defender group OR group contains one of the targeted players
                        if (opponentIsDefender) {
                            buffs.push(
                                specialist.modifiers.local.carrierToStarCombat
                                    .attacker.weapons,
                            );
                        } else if (
                            carrier.specialistTargetedPlayers.find((tpId) =>
                                targetedPlayers.find(
                                    (pId) => pId.toString() === tpId.toString(),
                                ),
                            )
                        ) {
                            buffs.push(
                                specialist.modifiers.local.carrierToStarCombat
                                    .attacker.weapons,
                            );
                        }
                    } else {
                        buffs.push(
                            specialist.modifiers.local.carrierToStarCombat
                                .attacker.weapons,
                        );
                    }
                }

                if (
                    !isAttacker &&
                    specialist.modifiers.local.carrierToStarCombat.defender
                        ?.weapons
                ) {
                    buffs.push(
                        specialist.modifiers.local.carrierToStarCombat.defender
                            .weapons,
                    );
                }

                if (
                    isAttacker &&
                    specialist.modifiers.local.carrierToStarCombat.attacker
                        ?.perAlly
                ) {
                    const adjustedAllyCount = Math.min(
                        allyCount,
                        specialist.modifiers.local.carrierToStarCombat.attacker
                            .perAlly.maxAllies,
                    );
                    buffs.push(
                        specialist.modifiers.local.carrierToStarCombat.attacker
                            .perAlly.weapons * adjustedAllyCount,
                    );
                }
            }

            if (
                !isCarrierToStarCombat &&
                specialist.modifiers.local.carrierToCarrierCombat?.weapons
            ) {
                buffs.push(
                    specialist.modifiers.local.carrierToCarrierCombat.weapons,
                );
            }

            if (specialist.modifiers.local.weapons) {
                buffs.push(specialist.modifiers.local.weapons);
            }
        }

        if (!buffs.length) {
            return undefined;
        }

        const relevantBuff = maxBy((a) => a, buffs);

        return {
            kind: "carrier",
            specialistId: carrier.specialistId,
            amount: relevantBuff,
        };
    }

    getCarriersWeaponsDebuff<ID>(
        carriersToCheck: CombatBaseCarrier<ID>[],
    ): Buff | undefined {
        if (!carriersToCheck.length) {
            return undefined;
        }

        // If any of the carriers have a specialist which deducts enemy weapons
        // then find the one that has the highest deduction.
        const allBuffs = carriersToCheck
            .filter((c) => c.specialistId != null)
            .flatMap((c) => {
                let specialist = this.specialistService.getByIdCarrier(
                    c.specialistId!,
                );

                if (
                    specialist &&
                    specialist.modifiers.special &&
                    specialist.modifiers.special.deductEnemyWeapons
                ) {
                    const buff: Buff = {
                        kind: "carrier",
                        specialistId: specialist.id,
                        amount: specialist.modifiers.special.deductEnemyWeapons,
                    };

                    return [buff];
                }

                return [];
            });

        return maxOf((b) => b.amount, allBuffs);
    }

    getBaseWeapons<ID extends Id, P extends CombatBasePlayer<ID>>(players: P[]) {
        return maxBy((p) => p.research.weapons.level, players);
    }

    getEffectiveWeaponsDetail<
        ID extends Id,
        P extends CombatBasePlayer<ID>,
        S extends CombatBaseStar<ID>,
        C extends CombatBaseCarrier<ID>,
    >(
        game: Game,
        group: CombatGroup<ID, P, S, C>,
        opponents: CombatGroup<ID, P, S, C>,
        isCarrierToStarCombat: boolean,
    ): WeaponsDetail {
        const baseWeapons = this.getBaseWeapons(group.players);

        let defenderBonus: number | undefined = undefined;
        if (group.isDefender) {
            defenderBonus = this.getDefenderBonus(game, group.star!);
        }

        const buffs: Buff[] = group.carriers
            .map((c) => {
                return this._getCarrierWeaponsBuff(
                    c,
                    isCarrierToStarCombat,
                    group.isDefender,
                    opponents.isDefender,
                    group.players.length,
                    c.specialistTargetedPlayers,
                );
            })
            .filter(notUndefined);

        if (group.star) {
            const starBuff = this._getStarWeaponsBuff(group.star);

            if (starBuff) {
                buffs.push(starBuff);
            }
        }

        const buff = this._calculateActualWeaponsBuff(
            baseWeapons,
            buffs,
            defenderBonus || 0,
        );

        const opponentDebuff = this.getCarriersWeaponsDebuff(opponents.carriers);

        const appliedBuffs = buff.appliedBuffs;

        if (opponentDebuff) {
            appliedBuffs.push(opponentDebuff);

            return {
                weaponsLevel: baseWeapons,
                appliedBuffs,
                weaponsBuff: buff.weaponsBuff - opponentDebuff.amount,
                total: buff.total - opponentDebuff.amount,
                defenderBonus,
            };
        } else {
            return {
                weaponsLevel: baseWeapons,
                appliedBuffs,
                weaponsBuff: buff.weaponsBuff,
                total: buff.total,
                defenderBonus,
            };
        }
    }

    _calculateActualWeaponsBuff(
        weapons: number,
        buffs: Buff[],
        additionalBuff: number,
    ): WeaponsDetail {
        const highestBuff = maxOf((b) => b.amount, buffs);
        const lowestBuff = minOf((b) => b.amount, buffs);

        const buff = Math.max(0, highestBuff?.amount || 0);
        const debuff = lowestBuff?.amount || 0;

        const appliedBuffs: Buff[] = [];

        if (buff > 0) {
            appliedBuffs.push(highestBuff!);
        }

        if (debuff < 0) {
            appliedBuffs.push(lowestBuff!);
        }

        const buffsTotal = appliedBuffs.reduce(
            (acc, curr) => acc + curr.amount,
            0,
        );

        const total = Math.max(1, weapons + buffsTotal + additionalBuff);

        return {
            weaponsLevel: weapons,
            total,
            appliedBuffs,
            weaponsBuff: buffsTotal,
        };
    }

    getDefenderBonus<ID>(game: Game, star: CombatBaseStar<ID>) {
        let bonus =
            game.settings.specialGalaxy.defenderBonus === "enabled" ? 1 : 0;

        if (star.isAsteroidField) {
            bonus++;
        }

        if (star.specialistId) {
            const specialist = this.specialistService.getByIdStar(
                star.specialistId,
            );

            if (specialist && specialist.modifiers.special?.defenderBonus) {
                bonus += specialist.modifiers.special.defenderBonus;
            }
        }

        if (star.homeStar) {
            if (this.gameTypeService.isCapitalStarEliminationMode(game)) {
                bonus += 1;
            } else {
                bonus *= game.constants.star.homeStarDefenderBonusMultiplier;
            }
        }

        return bonus;
    }
}
