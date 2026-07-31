/**
 * Regenerates test/parity/golden.json by running the generated scenarios
 * through a checkout of solaris-games/solaris.
 *
 *   git clone --depth 1 https://github.com/solaris-games/solaris /tmp/solaris
 *   SOLARIS_UPSTREAM=/tmp/solaris npm run parity:generate
 *
 * The committed golden file is upstream's output, so test/parity.spec.ts can
 * assert the port reproduces it without needing the upstream tree present.
 */
import { writeFileSync, readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  generateScenarios,
  runScenario,
  SHIPS_NEEDED_BUDGET,
} from "../test/parity/scenarios";

const upstream = process.env.SOLARIS_UPSTREAM;

if (!upstream) {
  console.error(
    "SOLARIS_UPSTREAM is not set. Point it at a checkout of solaris-games/solaris.",
  );
  process.exit(1);
}

const upstreamRoot = resolve(upstream);

const commonPath = (rel: string) => resolve(upstreamRoot, "common/src", rel);

for (const required of [
  "services/combat.ts",
  "services/technology.ts",
  "services/gameType.ts",
]) {
  if (!existsSync(commonPath(required))) {
    console.error(`Not a solaris checkout: missing common/src/${required}`);
    process.exit(1);
  }
}

const { CombatService } = await import(commonPath("services/combat.ts"));
const { TechnologyService } = await import(commonPath("services/technology.ts"));
const { GameTypeService } = await import(commonPath("services/gameType.ts"));

// Upstream reads specialists from the server config at runtime; the calculator
// bundles that same file. Load it from the checkout so the golden file is
// generated against upstream's data as well as upstream's code.
const specialists = JSON.parse(
  readFileSync(
    resolve(upstreamRoot, "server/config/game/specialists.json"),
    "utf8",
  ),
) as { carrier: any[]; star: any[] };

const specialistService = {
  getByIdCarrier: (id: number) =>
    specialists.carrier.find((s) => s.id === id) || null,
  getByIdStar: (id: number) => specialists.star.find((s) => s.id === id) || null,
};

const gameTypeService = new GameTypeService();
const technologyService = new TechnologyService(
  specialistService,
  gameTypeService,
);

// Upstream's constructor is (combatGroupService, technologyService,
// specialistService). combatGroupService is only used by computeStar /
// computeCarrier, which build groups from a live galaxy and are not exercised
// here, so a stub is correct rather than merely convenient.
const combatService = new CombatService(
  {},
  technologyService,
  specialistService,
);

const DUELS = Number(process.env.PARITY_DUELS || 120);
const MELEES = Number(process.env.PARITY_MELEES || 600);

const scenarios = generateScenarios(DUELS, MELEES);

console.log(
  `Running ${scenarios.length} scenarios (${DUELS} duels, ${MELEES} melees) against ${upstreamRoot}...`,
);

let droppedEstimates = 0;

const cases = scenarios.map((scenario, idx) => {
  const isDuel = idx < DUELS;

  if (!isDuel) {
    return {
      scenario,
      compareShipsNeeded: false,
      expected: runScenario(scenario, combatService),
    };
  }

  const withEstimate = runScenario(scenario, combatService, {
    estimateShipsNeeded: true,
  });

  // A huge answer means estimateNeeded ground its way towards the internal
  // 10,000 cap. Upstream and the port agree on those too, but replaying one
  // costs seconds, so the case keeps its battle comparison and drops the
  // estimate.
  const affordable = withEstimate.shipsNeeded.every(
    (n) => n === null || n <= SHIPS_NEEDED_BUDGET,
  );

  if (affordable) {
    return { scenario, compareShipsNeeded: true, expected: withEstimate };
  }

  droppedEstimates++;

  return {
    scenario,
    compareShipsNeeded: false,
    expected: runScenario(scenario, combatService),
  };
});

const compared = cases.filter((c) => c.compareShipsNeeded).length;

console.log(
  `estimateNeeded compared on ${compared} duels; ${droppedEstimates} dropped for exceeding ${SHIPS_NEEDED_BUDGET} ships`,
);

const outPath = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../test/parity/golden.json",
);

writeFileSync(
  outPath,
  JSON.stringify(
    {
      generatedFrom: "solaris-games/solaris",
      duels: DUELS,
      melees: MELEES,
      scenarioCount: cases.length,
      shipsNeededCompared: compared,
      cases,
    },
    // Compact: it is machine-generated, only ever regenerated wholesale, and
    // indentation costs a couple of megabytes in the repository.
  ) + "\n",
  "utf8",
);

console.log(`Wrote ${cases.length} cases to ${outPath}`);
