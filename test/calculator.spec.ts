// Covers the wiring this port adds on top of the upstream engine: the specialist
// data, the game-settings stand-in, and the advanced calculator's group builder.
import { describe, it, expect } from "vitest";
import { CombatService } from "../src/solaris/services/combat";
import { TechnologyService } from "../src/solaris/services/technology";
import { GameTypeService } from "../src/solaris/services/gameType";
import { SpecialistService } from "../src/solaris/services/specialist";
import { defaultGame, type Game } from "../src/solaris/types/game";
import { makeCombatGroups, type CCGroup } from "../src/calculator/types";

const specialistService = new SpecialistService();
const gameTypeService = new GameTypeService();
const technologyService = new TechnologyService(
  specialistService,
  gameTypeService,
);
const combatService = new CombatService<string>(
  technologyService,
  specialistService,
);

const LIEUTENANT = 2; // carrier, +1 weapons
const COLONEL = 3; // carrier, +2 weapons
const ADMIRAL = 1; // carrier, -1 weapons
const ORBITAL_CANNON = 4; // star, +1 defender bonus
const WAR_MACHINE = 7; // star, +5 weapons

const carrierGroup = (level: number, ships: number, specialistId = null as number | null): CCGroup => ({
  name: "carriers",
  weapons: { kind: "level", level },
  star: undefined,
  carriers: [{ ships, specialistId }],
});

const starGroup = (
  level: number,
  ships: number,
  star: Partial<NonNullable<CCGroup["star"]>> = {},
): CCGroup => ({
  name: "star",
  weapons: { kind: "level", level },
  star: {
    ships,
    specialistId: null,
    isHomeStar: false,
    isAsteroidField: false,
    ...star,
  },
  carriers: [],
});

const run = (game: Game, groups: CCGroup[]) => {
  const built = makeCombatGroups(game, groups, combatService);

  return combatService.calculateGroups(
    built,
    groups.some((g) => Boolean(g.star)),
  );
};

// `makeCombatGroups` sorts the defender first, so groups[0] is always the star
// side in carrier-to-star scenarios.
const weaponsOf = (result: ReturnType<typeof run>, idx: number) =>
  Object.values(result.groups[idx].attackAgainst)[0].total;

describe("specialist data", () => {
  it("loads the bundled specialists", () => {
    expect(specialistService.getByIdCarrier(LIEUTENANT)?.name).toBe(
      "Lieutenant",
    );
    expect(specialistService.getByIdStar(ORBITAL_CANNON)?.name).toBe(
      "Orbital Cannon",
    );
  });

  it("only offers combat-relevant specialists", () => {
    const carriers = specialistService.getCombatRelevant("carrier");
    const stars = specialistService.getCombatRelevant("star");

    expect(carriers.map((s) => s.id)).toContain(LIEUTENANT);
    expect(stars.map((s) => s.id)).toContain(ORBITAL_CANNON);
    // Space Dock only affects manufacturing - nothing for combat to read.
    expect(stars.map((s) => s.name)).not.toContain("Space Dock");
  });
});

describe("weapons buffs", () => {
  it("applies a carrier weapons specialist", () => {
    const game = defaultGame();

    const withoutSpec = run(game, [
      carrierGroup(3, 10),
      carrierGroup(1, 10),
    ]);
    const withSpec = run(game, [
      carrierGroup(3, 10, COLONEL),
      carrierGroup(1, 10),
    ]);

    expect(weaponsOf(withoutSpec, 0)).toBe(3);
    expect(weaponsOf(withSpec, 0)).toBe(5);
  });

  it("takes only the single highest buff, not the sum", () => {
    const game = defaultGame();

    const result = run(game, [
      {
        name: "carriers",
        weapons: { kind: "level", level: 1 },
        star: undefined,
        carriers: [
          { ships: 5, specialistId: LIEUTENANT },
          { ships: 5, specialistId: COLONEL },
        ],
      },
      carrierGroup(1, 10),
    ]);

    // 1 + max(1, 2) = 3, not 1 + 1 + 2.
    expect(weaponsOf(result, 0)).toBe(3);
  });

  it("applies a negative specialist modifier alongside the highest buff", () => {
    const game = defaultGame();

    const result = run(game, [
      {
        name: "carriers",
        weapons: { kind: "level", level: 5 },
        star: undefined,
        carriers: [
          { ships: 5, specialistId: COLONEL }, // +2
          { ships: 5, specialistId: ADMIRAL }, // -1
        ],
      },
      carrierGroup(1, 10),
    ]);

    expect(weaponsOf(result, 0)).toBe(6);
  });
});

describe("defender bonus", () => {
  it("adds +1 when the setting is enabled and nothing when disabled", () => {
    const enabled = defaultGame();
    const disabled = defaultGame();
    disabled.settings.specialGalaxy.defenderBonus = "disabled";

    expect(weaponsOf(run(enabled, [starGroup(2, 10), carrierGroup(2, 10)]), 0)).toBe(3);
    expect(weaponsOf(run(disabled, [starGroup(2, 10), carrierGroup(2, 10)]), 0)).toBe(2);
  });

  it("adds another +1 on an asteroid field", () => {
    const game = defaultGame();

    const result = run(game, [
      starGroup(2, 10, { isAsteroidField: true }),
      carrierGroup(2, 10),
    ]);

    expect(weaponsOf(result, 0)).toBe(4);
  });

  it("multiplies the bonus on a home star", () => {
    const game = defaultGame();
    game.constants.star.homeStarDefenderBonusMultiplier = 2;

    const result = run(game, [
      starGroup(2, 10, { isHomeStar: true }),
      carrierGroup(2, 10),
    ]);

    // (1 defender bonus) * 2 = 2.
    expect(weaponsOf(result, 0)).toBe(4);
  });

  it("adds a flat +1 on a home star in capital star elimination mode", () => {
    const game = defaultGame();
    game.settings.conquest.capitalStarElimination = "enabled";
    game.constants.star.homeStarDefenderBonusMultiplier = 2;

    const result = run(game, [
      starGroup(2, 10, { isHomeStar: true }),
      carrierGroup(2, 10),
    ]);

    // 1 defender bonus + 1 capital, multiplier ignored.
    expect(weaponsOf(result, 0)).toBe(4);
  });

  it("adds a star specialist's defender bonus", () => {
    const game = defaultGame();

    const result = run(game, [
      starGroup(2, 10, { specialistId: ORBITAL_CANNON }),
      carrierGroup(2, 10),
    ]);

    // Weapons 2, +1 defender bonus, +1 from Orbital Cannon.
    expect(weaponsOf(result, 0)).toBe(4);
  });

  it("stacks a star weapons specialist on top of the defender bonus", () => {
    const game = defaultGame();

    const result = run(game, [
      starGroup(2, 10, { specialistId: WAR_MACHINE }),
      carrierGroup(2, 10),
    ]);

    // Weapons 2, +5 from War Machine, +1 defender bonus.
    expect(weaponsOf(result, 0)).toBe(8);
  });
});

describe("hand-entered players", () => {
  it("uses the highest weapons level in the group", () => {
    const game = defaultGame();

    const result = run(game, [
      {
        name: "allies",
        weapons: {
          kind: "players",
          players: [
            { name: "A", weaponsLevel: 2 },
            { name: "B", weaponsLevel: 6 },
            { name: "C", weaponsLevel: 4 },
          ],
        },
        star: undefined,
        carriers: [{ ships: 10, specialistId: null }],
      },
      carrierGroup(1, 10),
    ]);

    expect(weaponsOf(result, 0)).toBe(6);
  });
});

describe("lopsided battles do not hang", () => {
  // 45 v 231231 used to lock the page for minutes: "ships needed" walks up one
  // ship at a time, re-fighting the whole battle at each step, which is
  // quadratic in the size of the battle. It now gives up once it has done a
  // fixed amount of work and reports that it could not be determined.
  const timed = <T>(fn: () => T): [T, number] => {
    const started = performance.now();
    const out = fn();
    return [out, performance.now() - started];
  };

  it("answers the reported 45 v 231231 case quickly", () => {
    const [result, ms] = timed(() =>
      combatService.calculateBasic(
        { ships: 45, weaponsLevel: 1 },
        { ships: 231231, weaponsLevel: 1 },
        true,
        true,
      ),
    );

    // The battle itself is resolved exactly.
    expect(result.defender.shipsAfter).toBe(0);
    expect(result.attacker.shipsAfter).toBe(231141);

    // The exact figure, not a ceiling. 231,231 attacking ships at 1 damage a
    // round against a star returning 2 takes 115,616 rounds to clear, and the
    // star loses one ship a round throughout.
    expect(result.defender.shipsNeeded).toBe(115616);

    // This used to take several minutes.
    expect(ms).toBeLessThan(5000);
  });

  it("stays fast when both sides are huge", () => {
    const [result, ms] = timed(() =>
      combatService.calculateBasic(
        { ships: 231231, weaponsLevel: 1 },
        { ships: 231231, weaponsLevel: 3 },
        true,
        true,
      ),
    );

    expect(result.attacker.shipsAfter).toBe(77077);
    expect(ms).toBeLessThan(5000);
  });

  it("still gives the exact answer when the battle is a normal size", () => {
    // Unchanged by the budget: these are the numbers upstream produces.
    expect(
      combatService.calculateBasic(
        { ships: 45, weaponsLevel: 1 },
        { ships: 60, weaponsLevel: 1 },
        true,
        true,
      ).attacker.shipsNeeded,
    ).toBe(91);

    expect(
      combatService.calculateBasic(
        { ships: 45, weaponsLevel: 1 },
        { ships: 1000, weaponsLevel: 1 },
        true,
        true,
      ).defender.shipsNeeded,
    ).toBe(500);
  });

  it("answers battles that the one-at-a-time walk could not reach", () => {
    // Every one of these used to be abandoned, or take tens of seconds.
    const needed = (attackerShips: number) =>
      combatService.calculateBasic(
        { ships: 45, weaponsLevel: 1 },
        { ships: attackerShips, weaponsLevel: 1 },
        true,
        true,
      ).defender.shipsNeeded;

    expect(needed(2400)).toBe(1200);
    expect(needed(3000)).toBe(1500);
    expect(needed(5000)).toBe(2500);

    // 92 seconds under the old walk. Upstream would answer 10,001 here, its
    // ceiling; the real figure happens to be just under it.
    const [answer, ms] = timed(() => needed(20000));
    expect(answer).toBe(10000);
    expect(ms).toBeLessThan(5000);
  });

  it("gives up rather than grinding when even jumping is too slow", () => {
    // Five million attacking ships needs an answer near 2.5 million, and every
    // probe has to fight a battle that long. The work budget stops it.
    const [result, ms] = timed(() =>
      combatService.calculateBasic(
        { ships: 45, weaponsLevel: 1 },
        { ships: 5_000_000, weaponsLevel: 1 },
        true,
        true,
      ),
    );

    expect(result.defender.shipsNeeded).toBeNull();
    expect(ms).toBeLessThan(10000);
  });
});

describe("ship totals", () => {
  it("sums carriers and the star into the group's ships", () => {
    const game = defaultGame();

    const result = run(game, [
      {
        name: "defenders",
        weapons: { kind: "level", level: 1 },
        star: {
          ships: 10,
          specialistId: null,
          isHomeStar: false,
          isAsteroidField: false,
        },
        carriers: [
          { ships: 5, specialistId: null },
          { ships: 3, specialistId: null },
        ],
      },
      carrierGroup(1, 1),
    ]);

    expect(result.groups[0].shipsBefore).toBe(18);
  });
});
