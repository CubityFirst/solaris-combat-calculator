// Differential test against the production implementation.
//
// golden.json holds several hundred randomly generated battles together with
// the results solaris-games/solaris produces for them - up to six combat
// groups, stars and carriers mixed within a group, specialists on both, groups
// with several allied players, home stars, asteroid fields, and the galaxy
// settings that feed the defender bonus. Each case is replayed through the
// ported engine and compared field by field: per-group and per-object ship
// counts, kill and loss tallies, the effective weapons every group attacked
// every other group at, and the winner. The small two-group band additionally
// compares `estimateNeeded` - the "would have needed N ships" figure.
//
// Regenerate with `npm run parity:generate` against an upstream checkout.
import { describe, it, expect } from "vitest";
import golden from "./parity/golden.json";
import { generateScenarios, runScenario } from "./parity/scenarios";
import { combatService } from "../src/services";

type GoldenCase = {
  scenario: any;
  compareShipsNeeded: boolean;
  expected: any;
};

const cases = golden.cases as GoldenCase[];

describe("parity with solaris-games/solaris", () => {
  it("has a golden file to check against", () => {
    expect(cases.length).toBeGreaterThan(0);
    expect(golden.shipsNeededCompared).toBeGreaterThan(0);
  });

  it("reproduces upstream's result for every recorded battle", () => {
    const mismatches: { name: string; actual: any; expected: any }[] = [];

    for (const { scenario, compareShipsNeeded, expected } of cases) {
      const actual = runScenario(scenario, combatService, {
        estimateShipsNeeded: compareShipsNeeded,
      });

      if (JSON.stringify(actual) !== JSON.stringify(expected)) {
        mismatches.push({ name: scenario.name, actual, expected });
      }
    }

    expect(mismatches.map((m) => m.name)).toEqual([]);
  });

  it("covers battles of real complexity", () => {
    const scenarios = cases.map((c) => c.scenario);

    const groupCounts = scenarios.map((s) => s.groups.length);
    const objectCounts = scenarios.map((s) =>
      s.groups.reduce(
        (sum: number, g: any) => sum + g.carriers.length + (g.star ? 1 : 0),
        0,
      ),
    );

    const some = (pred: (s: any) => boolean) => scenarios.some(pred);
    const someGroup = (pred: (g: any) => boolean) =>
      some((s) => s.groups.some(pred));

    // Guards against the golden file being regenerated from a degenerate
    // scenario set that would pass trivially.
    expect(Math.max(...groupCounts)).toBeGreaterThanOrEqual(6);
    expect(Math.max(...objectCounts)).toBeGreaterThanOrEqual(10);

    expect(someGroup((g) => Boolean(g.star))).toBe(true); // carrier-to-star
    expect(some((s) => !s.groups.some((g: any) => g.star))).toBe(true); // carrier-to-carrier
    expect(someGroup((g) => g.star?.specialistId)).toBe(true);
    expect(someGroup((g) => g.carriers.some((c: any) => c.specialistId))).toBe(
      true,
    );
    expect(someGroup((g) => g.weaponsLevels.length > 1)).toBe(true);
    expect(someGroup((g) => g.star?.homeStar)).toBe(true);
    expect(someGroup((g) => g.star?.isAsteroidField)).toBe(true);
    expect(someGroup((g) => g.star && g.carriers.length > 0)).toBe(true);

    expect(some((s) => s.game.defenderBonus === "disabled")).toBe(true);
    expect(some((s) => s.game.capitalStarElimination === "enabled")).toBe(true);
    expect(some((s) => s.game.homeStarDefenderBonusMultiplier === 2)).toBe(true);
  });

  it("regenerates the same scenarios from the same seed", () => {
    // The golden file records its own inputs, so this only guards the
    // generator against accidental change.
    const regenerated = generateScenarios(golden.duels, golden.melees);

    expect(JSON.stringify(regenerated)).toEqual(
      JSON.stringify(cases.map((c) => c.scenario)),
    );
  });
});
