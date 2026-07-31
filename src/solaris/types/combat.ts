// Ported from solaris-games/solaris (GPL-3.0-or-later): common/src/types/common/combat.ts
// Only the types reachable from the combat calculator are kept; the event-log /
// persistence result types were dropped because they are server-side concerns.
import type { WeaponsDetail } from "../services/technology";

export interface CombatBaseStar<ID> {
    _id: ID;
    ships: number | null; // annoying, but for weird compat reasons
    specialistId: number | null;
    ownedByPlayerId: ID | null;
    isAsteroidField: boolean;
    homeStar: boolean;
}

export interface CombatBaseCarrier<ID> {
    _id: ID;
    ships: number | null; // annoying, but for weird compat reasons
    specialistId: number | null;
    specialistTargetedPlayers: ID[];
    ownedByPlayerId: ID | null;
}

export interface CombatBasePlayer<ID> {
    _id: ID;
    research: {
        weapons: {
            level: number;
        };
    };
}

export type CombatGroup<
    ID,
    P extends CombatBasePlayer<ID>,
    S extends CombatBaseStar<ID>,
    C extends CombatBaseCarrier<ID>,
> = {
    id: string;
    originalShips: number;
    ships: number;
    isDefender: boolean;
    attackAgainst: Map<number, WeaponsDetail>;
    players: P[];
    carriers: C[];
    star: S | undefined;
    shipsKilled: number;
};

export interface DetailedCombatResultObject {
    shipsBefore: number;
    shipsAfter: number;
    shipsLost: number;
}

export interface DetailedCombatResultCarrier<
    ID,
    C extends CombatBaseCarrier<ID>,
> extends DetailedCombatResultObject {
    carrier: C;
}

export interface DetailedCombatResultStar<ID, S extends CombatBaseStar<ID>>
    extends DetailedCombatResultObject {
    star: S;
}

export type DetailedCombatResultGroup<
    ID,
    P extends CombatBasePlayer<ID>,
    S extends CombatBaseStar<ID>,
    C extends CombatBaseCarrier<ID>,
> = {
    id: string;
    players: P[];
    carriers: DetailedCombatResultCarrier<ID, C>[];
    star: DetailedCombatResultStar<ID, S> | undefined;
    attackAgainst: Record<string, WeaponsDetail>;
    shipsBefore: number;
    shipsAfter: number;
    shipsLost: number;
    shipsKilled: number;
    carriersKilled: number;
    carriersLost: number;
    specialistsKilled: number;
    specialistsLost: number;
};

export type DetailedCombatResult<
    ID,
    P extends CombatBasePlayer<ID>,
    S extends CombatBaseStar<ID>,
    C extends CombatBaseCarrier<ID>,
> = {
    groups: DetailedCombatResultGroup<ID, P, S, C>[];
    combatGroups: CombatGroup<ID, P, S, C>[];
    isCarrierToStarCombat: boolean;
};

// For combat calculator etc
export type BasicCombatResult = {
    defender: {
        shipsBefore: number;
        shipsAfter: number;
        shipsLost: number;
        shipsNeeded: number | undefined;
    };
    attacker: {
        shipsBefore: number;
        shipsAfter: number;
        shipsLost: number;
        shipsNeeded: number | undefined;
    };
};
