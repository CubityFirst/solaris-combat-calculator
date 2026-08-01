// The jump-and-refine search for "ships needed", checked against the exact
// one-at-a-time walk it replaces.
//
// Winning is not monotone in ship count, so the refinement keeps going until it
// has seen REFINE_FAIL_RUN losses in a row. This measures whether that run is
// long enough: it reconstructs the full win curve for a few hundred battles,
// finds the widest gap between winning counts anywhere in them, and checks the
// fast search agrees with the exact answer in every case.
import { describe, it, expect } from "vitest";
import golden from "./parity/golden.json";
import { combatService } from "../src/services";
import {
  buildGroups,
  gameFor,
  generateScenarios,
  isCarrierToStar,
  type Scenario,
} from "./parity/scenarios";

/** Mirrors how estimateNeeded builds each probe, so the two are comparable. */
const winsWith = (
  scenario: Scenario,
  groupId: string,
  originalShips: number,
  ships: number,
) => {
  const game = gameFor(scenario);
  const c2s = isCarrierToStar(scenario);

  const groups = buildGroups(scenario);
  combatService.computeGroupWeapons(game, groups, c2s);

  const target = groups.find((g: any) => g.id === groupId)!;
  const extra = ships - originalShips;

  target.originalShips = ships;
  target.ships = ships;

  if (target.star) {
    target.star = { ...target.star, ships: target.star.ships + extra };
  } else {
    target.carriers = [...target.carriers];
    target.carriers[0] = {
      ...target.carriers[0],
      ships: target.carriers[0].ships + extra,
    };
  }

  const result = combatService.calculateGroups(groups, c2s);
  const mine = result.groups.find((g: any) => g.id === groupId)!;

  if (!target.star) {
    return mine.shipsAfter > 0;
  }

  return result.groups
    .filter((g: any) => g !== mine)
    .every((g: any) => g.shipsAfter === 0);
};

type Case = {
  scenario: Scenario;
  groupId: string;
  originalShips: number;
  exact: number;
  curve: boolean[];
};

/**
 * Battles small enough that the exact walk is affordable, along with the win
 * curve above the answer so gaps can be measured.
 */
const collectCases = (count: number): Case[] => {
  const cases: Case[] = [];

  for (const scenario of generateScenarios(count, 0)) {
    const game = gameFor(scenario);
    const c2s = isCarrierToStar(scenario);

    const groups = buildGroups(scenario);
    combatService.computeGroupWeapons(game, groups, c2s);

    const result = combatService.calculateGroups(groups, c2s);
    const winner = combatService.getWinnerDetailed(result);

    for (const group of result.groups) {
      if (group === winner || group.shipsAfter > 0) {
        continue;
      }

      const originalShips = group.shipsBefore;

      // Walk up one at a time, exactly as upstream does.
      let exact = -1;
      const curve: boolean[] = [];

      for (let n = originalShips + 1; n <= originalShips + 400; n++) {
        const won = winsWith(scenario, group.id, originalShips, n);
        curve.push(won);

        if (won && exact === -1) {
          exact = n;
        }

        // Enough curve past the answer to see any gaps above it.
        if (exact !== -1 && n > exact + 30) {
          break;
        }
      }

      if (exact === -1) {
        continue;
      }

      cases.push({ scenario, groupId: group.id, originalShips, exact, curve });
    }
  }

  return cases;
};

const cases = collectCases(140);

describe("jump-and-refine ships-needed search", () => {
  it("has enough battles to be worth checking", () => {
    expect(cases.length).toBeGreaterThan(40);
  });

  it("never sees a gap wider than the refinement run", () => {
    // The gap that matters: consecutive losses sitting between two wins. If one
    // were ever wider than REFINE_FAIL_RUN, the refinement could stop above an
    // isolated winning count and report too high a number.
    let widest = 0;
    let widestAt = "";

    for (const c of cases) {
      let run = 0;
      let seenWin = false;

      c.curve.forEach((won, idx) => {
        if (won) {
          if (seenWin && run > widest) {
            widest = run;
            widestAt = `${c.scenario.name}/${c.groupId} at ${
              c.originalShips + 1 + idx
            }`;
          }
          seenWin = true;
          run = 0;
        } else if (seenWin) {
          run++;
        }
      });
    }

    console.log(
      `widest gap between winning counts: ${widest}` +
        (widestAt ? ` (${widestAt})` : ""),
    );

    // REFINE_FAIL_RUN is 8.
    expect(widest).toBeLessThan(8);
  });

  it("agrees with the exact walk on every battle", () => {
    const mismatches: string[] = [];

    for (const c of cases) {
      const game = gameFor(c.scenario);
      const c2s = isCarrierToStar(c.scenario);

      const groups = buildGroups(c.scenario);
      combatService.computeGroupWeapons(game, groups, c2s);

      const result = combatService.calculateGroups(groups, c2s);
      const group = result.groups.find((g: any) => g.id === c.groupId)!;

      const fast = combatService.estimateNeeded(
        result,
        group,
        group.star ? "eliminateOtherGroups" : "greaterThanZeroShips",
      );

      if (fast !== c.exact) {
        mismatches.push(
          `${c.scenario.name}/${c.groupId}: fast=${fast} exact=${c.exact}`,
        );
      }
    }

    expect(mismatches).toEqual([]);
  });

  it("finds a winning count that sits alone below a gap", () => {
    // The case that rules out a plain binary search: 179 wins, 180 and 181
    // lose, 182 wins again. Taken from the golden file rather than regenerated,
    // because the generator's sequence depends on how many duels precede it.
    const scenario = (golden.cases as { scenario: Scenario }[])
      .map((c) => c.scenario)
      .find((s) => s.name === "scenario-81");

    expect(scenario).toBeDefined();

    const game = gameFor(scenario!);
    const c2s = isCarrierToStar(scenario!);

    const groups = buildGroups(scenario!);
    combatService.computeGroupWeapons(game, groups, c2s);

    const result = combatService.calculateGroups(groups, c2s);
    const star = result.groups.find((g: any) => g.star)!;

    expect(
      combatService.estimateNeeded(result, star, "eliminateOtherGroups"),
    ).toBe(179);
  });
});
