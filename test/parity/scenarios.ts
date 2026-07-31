// Scenario generation and result normalisation for the upstream parity check.
//
// Nothing here imports either combat engine. The generated scenarios are plain
// data, so the same scenario can be fed to the ported engine and to a checkout
// of upstream, and the two normalised results compared field by field.
//
// See test/parity.spec.ts (replays the committed golden file) and
// scripts/generate-parity-golden.ts (regenerates it from an upstream checkout).

export type ScenarioStar = {
  ships: number;
  specialistId: number | null;
  homeStar: boolean;
  isAsteroidField: boolean;
};

export type ScenarioCarrier = {
  ships: number;
  specialistId: number | null;
};

export type ScenarioGroup = {
  /** One entry per player in the group; the engine fights at the highest. */
  weaponsLevels: number[];
  star: ScenarioStar | null;
  carriers: ScenarioCarrier[];
};

export type Scenario = {
  name: string;
  game: {
    defenderBonus: "enabled" | "disabled";
    capitalStarElimination: "enabled" | "disabled";
    homeStarDefenderBonusMultiplier: number;
  };
  groups: ScenarioGroup[];
};

/**
 * How much of a scenario to compare.
 *
 * `estimateNeeded` re-runs the entire battle once per extra ship and gives up
 * at 10,000, so for a group that cannot win however many ships it is handed it
 * costs 10,000 full simulations - seconds for a single case. Resolving the
 * battle itself, by contrast, is microseconds. The two are therefore compared
 * on different bands: every scenario compares the battle, and only the small
 * two-group ones with a quickly-converging answer also compare the estimate.
 */
export type RunOptions = {
  estimateShipsNeeded: boolean;
};

/**
 * Above this, `estimateNeeded` is grinding towards its internal 10,000 cap and
 * the case is dropped from the estimate comparison. Chosen on the value rather
 * than elapsed time so the golden file does not depend on machine speed.
 */
export const SHIPS_NEEDED_BUDGET = 500;

// Upstream's specialists.json: carrier ids 1-21, star ids 1-18.
const CARRIER_SPECIALIST_IDS = Array.from({ length: 21 }, (_, i) => i + 1);
const STAR_SPECIALIST_IDS = Array.from({ length: 18 }, (_, i) => i + 1);

/** mulberry32 - small, seeded, and identical across runs. */
const makeRng = (seed: number) => {
  let a = seed >>> 0;

  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

/**
 * @param duelCount   small two-group battles, used for the estimate comparison
 * @param meleeCount  up to six groups with stars, carriers and specialists
 */
export const generateScenarios = (
  duelCount: number,
  meleeCount: number,
  seed = 0x50_1a_21_5,
): Scenario[] => {
  const count = duelCount + meleeCount;
  const rng = makeRng(seed);
  const int = (min: number, max: number) =>
    min + Math.floor(rng() * (max - min + 1));
  const pick = <T>(list: T[]): T => list[int(0, list.length - 1)];
  const chance = (p: number) => rng() < p;

  const scenarios: Scenario[] = [];

  for (let i = 0; i < count; i++) {
    const isDuel = i < duelCount;

    const groupCount = isDuel ? 2 : int(2, 6);
    // Ship counts are kept modest so the whole set replays in a couple of
    // seconds on every `npm test`. What matters for parity is the branching -
    // group and object counts, specialists, defender-bonus sources - not the
    // magnitude of the numbers, which only lengthens the round loop.
    const maxShips = isDuel ? 30 : 80;

    // At most one group holds the contested star, matching what the UI allows
    // and what carrier-to-star combat means.
    const starGroupIdx = chance(0.6) ? int(0, groupCount - 1) : -1;

    const groups: ScenarioGroup[] = [];

    for (let g = 0; g < groupCount; g++) {
      const playerCount = chance(0.35) ? int(2, 4) : 1;

      const weaponsLevels = Array.from({ length: playerCount }, () =>
        int(1, 12),
      );

      const isStarGroup = g === starGroupIdx;

      // A group must hold at least one object, or there is nothing to destroy.
      const carrierCount = isStarGroup ? int(0, 4) : int(1, 4);

      const carriers: ScenarioCarrier[] = Array.from(
        { length: carrierCount },
        () => ({
          ships: int(0, maxShips),
          specialistId: chance(0.45) ? pick(CARRIER_SPECIALIST_IDS) : null,
        }),
      );

      const star: ScenarioStar | null = isStarGroup
        ? {
            ships: int(0, maxShips),
            specialistId: chance(0.45) ? pick(STAR_SPECIALIST_IDS) : null,
            homeStar: chance(0.3),
            isAsteroidField: chance(0.3),
          }
        : null;

      groups.push({ weaponsLevels, star, carriers });
    }

    scenarios.push({
      name: `scenario-${i}`,
      game: {
        defenderBonus: chance(0.75) ? "enabled" : "disabled",
        capitalStarElimination: chance(0.25) ? "enabled" : "disabled",
        homeStarDefenderBonusMultiplier: pick([1, 1, 2]),
      },
      groups,
    });
  }

  return scenarios;
};

export const isCarrierToStar = (scenario: Scenario) =>
  scenario.groups.some((g) => g.star !== null);

export const gameFor = (scenario: Scenario) => ({
  settings: {
    specialGalaxy: { defenderBonus: scenario.game.defenderBonus },
    conquest: { capitalStarElimination: scenario.game.capitalStarElimination },
  },
  constants: {
    star: {
      homeStarDefenderBonusMultiplier:
        scenario.game.homeStarDefenderBonusMultiplier,
    },
  },
});

/**
 * Build the CombatGroup array both engines operate on. Deliberately returns
 * plain objects: the two implementations declare structurally identical types,
 * so one builder can feed both, and any divergence must come from the engines
 * rather than from how the input was assembled.
 */
export const buildGroups = (scenario: Scenario): any[] =>
  scenario.groups.map((g, idx) => {
    const players = g.weaponsLevels.map((level, pidx) => ({
      _id: `G${idx}_P${pidx}`,
      research: { weapons: { level } },
    }));

    const ownerId = players[0]._id;

    const carriers = g.carriers.map((c, cidx) => ({
      _id: `G${idx}_C${cidx}`,
      ships: c.ships,
      specialistId: c.specialistId,
      specialistTargetedPlayers: [],
      ownedByPlayerId: ownerId,
    }));

    const star = g.star
      ? {
          _id: `G${idx}_S`,
          ships: g.star.ships,
          specialistId: g.star.specialistId,
          ownedByPlayerId: ownerId,
          homeStar: g.star.homeStar,
          isAsteroidField: g.star.isAsteroidField,
        }
      : undefined;

    const totalShips =
      carriers.reduce((sum, c) => sum + c.ships, 0) + (star ? star.ships : 0);

    return {
      id: `Group ${idx}`,
      originalShips: totalShips,
      ships: totalShips,
      isDefender: Boolean(star),
      attackAgainst: new Map(),
      players,
      carriers,
      star,
      shipsKilled: 0,
    };
  });

const normaliseWeapons = (wd: any) => ({
  total: wd.total,
  weaponsLevel: wd.weaponsLevel,
  weaponsBuff: wd.weaponsBuff,
  defenderBonus: wd.defenderBonus ?? null,
  appliedBuffs: (wd.appliedBuffs || []).map((b: any) => ({
    kind: b.kind,
    amount: b.amount,
    specialistId: b.specialistId,
  })),
});

const normaliseObject = (o: any) =>
  o
    ? {
        shipsBefore: o.shipsBefore,
        shipsLost: o.shipsLost,
        shipsAfter: o.shipsAfter,
      }
    : null;

/**
 * Project a DetailedCombatResult down to comparable, JSON-safe data: per-group
 * totals, the per-object damage split, the effective weapons each group
 * attacked every other group at, the winner, and the ships each losing group
 * would have needed.
 */
export const normaliseResult = (
  result: any,
  winnerIndex: number,
  shipsNeeded: (number | null)[],
) => ({
  isCarrierToStarCombat: result.isCarrierToStarCombat,
  winnerIndex,
  shipsNeeded,
  groups: result.groups.map((g: any) => ({
    id: g.id,
    shipsBefore: g.shipsBefore,
    shipsLost: g.shipsLost,
    shipsAfter: g.shipsAfter,
    shipsKilled: g.shipsKilled,
    carriersLost: g.carriersLost,
    carriersKilled: g.carriersKilled,
    specialistsLost: g.specialistsLost,
    specialistsKilled: g.specialistsKilled,
    star: normaliseObject(g.star),
    carriers: g.carriers.map(normaliseObject),
    attackAgainst: Object.fromEntries(
      Object.entries(g.attackAgainst).map(([k, v]) => [k, normaliseWeapons(v)]),
    ),
  })),
});

/**
 * Run one scenario through a combat service and normalise the outcome. Takes
 * the service rather than importing one, so the caller decides whether it is
 * the ported engine or an upstream checkout.
 */
export const runScenario = (
  scenario: Scenario,
  combatService: any,
  options: RunOptions = { estimateShipsNeeded: false },
) => {
  const game = gameFor(scenario);
  const c2s = isCarrierToStar(scenario);

  const groups = buildGroups(scenario);

  combatService.computeGroupWeapons(game, groups, c2s);

  const result = combatService.calculateGroups(groups, c2s);

  const winner = combatService.getWinnerDetailed(result);
  const winnerIndex = winner ? result.groups.indexOf(winner) : -1;

  // estimateNeeded is only meaningful for the groups that lost, so it is
  // skipped for the winner. Order matters: it mutates the group it is
  // estimating for, so both engines must be driven through the same sequence.
  const shipsNeeded = result.groups.map((g: any) => {
    if (g === winner || !options.estimateShipsNeeded) {
      return null;
    }

    return combatService.estimateNeeded(
      result,
      g,
      g.star ? "eliminateOtherGroups" : "greaterThanZeroShips",
    );
  });

  return normaliseResult(result, winnerIndex, shipsNeeded);
};
