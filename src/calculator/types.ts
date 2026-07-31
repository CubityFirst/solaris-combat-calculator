// Ported from solaris-games/solaris (GPL-3.0-or-later):
// client/src/views/game/components/combatcalculator/types.ts
//
// In-game, the "players" weapons mode picks real players out of the galaxy. Here
// there is no galaxy, so a group's players are entered by hand. The combat code
// only ever reads two things off that list -- the highest weapons level
// (`getBaseWeapons`) and the number of players in the group (the ally count used
// by Siege Breaker's per-ally buff) -- so hand-entered players are equivalent.
import type {
  CombatBaseCarrier,
  CombatBasePlayer,
  CombatBaseStar,
  CombatGroup,
} from "@/solaris/types/combat";
import type { CombatService } from "@/solaris/services/combat";
import type { Game } from "@/solaris/types/game";

export type CCCarrier = {
  ships: number;
  specialistId: number | null;
};

export type CCStar = {
  ships: number;
  specialistId: number | null;
  isHomeStar: boolean;
  isAsteroidField: boolean;
};

export type CCPlayer = {
  name: string;
  weaponsLevel: number;
};

export type CCGroupWeaponsSpec =
  | { kind: "level"; level: number }
  | { kind: "players"; players: CCPlayer[] };

export type CCGroup = {
  weapons: CCGroupWeaponsSpec;
  name: string;
  star: CCStar | undefined;
  carriers: CCCarrier[];
};

export const makeCombatGroups = (
  game: Game,
  gr: CCGroup[],
  combatService: CombatService<string>,
): CombatGroup<
  string,
  CombatBasePlayer<string>,
  CombatBaseStar<string>,
  CombatBaseCarrier<string>
>[] => {
  const combatGroups = gr.map((g, idx) => {
    const totalShips =
      g.carriers.reduce((acc, c) => acc + c.ships, 0) +
      (g.star ? g.star.ships : 0);

    let players: CombatBasePlayer<string>[];

    if (g.weapons.kind === "level") {
      players = [
        {
          _id: `Group_${idx}`,
          research: {
            weapons: {
              level: g.weapons.level,
            },
          },
        },
      ];
    } else {
      players = g.weapons.players.map((p, pidx) => ({
        _id: `Group_${idx}_Player_${pidx}`,
        research: {
          weapons: {
            level: p.weaponsLevel,
          },
        },
      }));
    }

    const firstPlayer = players[0];

    const mapStar = (star: CCStar): CombatBaseStar<string> => {
      return {
        _id: `Star_${idx}`,
        ships: star.ships,
        specialistId: star.specialistId,
        ownedByPlayerId: firstPlayer._id,
        homeStar: star.isHomeStar,
        isAsteroidField: star.isAsteroidField,
      };
    };

    const mapCarrier = (
      carrier: CCCarrier,
      cidx: number,
    ): CombatBaseCarrier<string> => {
      return {
        _id: `Carrier_${idx}_${cidx}`,
        ships: carrier.ships,
        specialistId: carrier.specialistId,
        specialistTargetedPlayers: [],
        ownedByPlayerId: firstPlayer._id,
      };
    };

    return {
      id: `Group ${idx}`,
      originalShips: totalShips,
      ships: totalShips,
      isDefender: Boolean(g.star),
      attackAgainst: new Map(), // later
      shipsKilled: 0,
      players,
      star: g.star ? mapStar(g.star) : undefined,
      carriers: g.carriers.map(mapCarrier),
    };
  });

  const isC2S = Boolean(combatGroups.find((cg) => Boolean(cg.star)));

  combatService.computeGroupWeapons(game, combatGroups, isC2S);

  return combatGroups;
};
