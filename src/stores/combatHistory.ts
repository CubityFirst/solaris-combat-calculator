// Recent battles, kept in localStorage so they survive a refresh.
//
// An entry stores the full inputs as well as the summary, so a battle can be
// loaded back into the calculator exactly as it was fought - including the
// galaxy settings, which change the result.
import { computed, ref, watch } from "vue";
import type { CCGroup } from "@/calculator/types";
import type { Game } from "@/solaris/types/game";
import { game } from "@/stores/game";
import { loadBasicInput } from "@/stores/basicCalculator";
import { replaceGroups } from "@/stores/combatCalculator";
import { isAdvanced } from "@/stores/ui";

const STORAGE_KEY = "solaris-combat-calculator:history";

/** How many battles are kept. The rest fall off the end. */
export const HISTORY_LIMIT = 20;

/** How many are shown before "Show all". */
export const HISTORY_PREVIEW = 3;

export type GameSnapshot = {
  defenderBonus: Game["settings"]["specialGalaxy"]["defenderBonus"];
  capitalStarElimination: Game["settings"]["conquest"]["capitalStarElimination"];
  homeStarDefenderBonusMultiplier: number;
};

export type HistorySide = {
  label: string;
  ships: number;
};

type BaseEntry = {
  id: string;
  at: number;
  /** Total ships each side brought, and who walked away with the field. */
  sides: HistorySide[];
  winner: string | null;
  game: GameSnapshot;
};

export type BasicHistoryEntry = BaseEntry & {
  kind: "basic";
  input: {
    defender: { ships: number; weaponsLevel: number };
    attacker: { ships: number; weaponsLevel: number };
    isCarrierToStar: boolean;
    includeDefenderBonus: boolean;
  };
};

export type AdvancedHistoryEntry = BaseEntry & {
  kind: "advanced";
  input: {
    groups: CCGroup[];
  };
};

export type HistoryEntry = BasicHistoryEntry | AdvancedHistoryEntry;

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

const load = (): HistoryEntry[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);

    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw);

    if (!Array.isArray(parsed)) {
      return [];
    }

    // Tolerate anything unrecognised rather than throwing away the whole list
    // or, worse, crashing the app on load.
    return parsed
      .filter(
        (e) =>
          e &&
          (e.kind === "basic" || e.kind === "advanced") &&
          Array.isArray(e.sides) &&
          e.input,
      )
      .slice(0, HISTORY_LIMIT);
  } catch {
    return [];
  }
};

export const entries = ref<HistoryEntry[]>(load());

watch(
  entries,
  (list) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    } catch {
      // Storage unavailable (private mode, quota) - history just won't persist.
    }
  },
  { deep: true },
);

export const recentEntries = computed(() =>
  entries.value.slice(0, HISTORY_PREVIEW),
);

export const hasMoreEntries = computed(
  () => entries.value.length > HISTORY_PREVIEW,
);

const snapshotGame = (): GameSnapshot => ({
  defenderBonus: game.settings.specialGalaxy.defenderBonus,
  capitalStarElimination: game.settings.conquest.capitalStarElimination,
  homeStarDefenderBonusMultiplier:
    game.constants.star.homeStarDefenderBonusMultiplier,
});

let counter = 0;

const nextId = (at: number) => `${at}-${counter++}`;

export const addEntry = (
  entry: Omit<HistoryEntry, "id" | "at" | "game">,
): HistoryEntry => {
  const at = Date.now();

  const full = {
    ...clone(entry),
    id: nextId(at),
    at,
    game: snapshotGame(),
  } as HistoryEntry;

  entries.value = [full, ...entries.value].slice(0, HISTORY_LIMIT);

  return full;
};

export const clearHistory = () => {
  entries.value = [];
};

/**
 * Loads a battle back into the calculator it was fought in.
 *
 * This writes to the stores directly rather than handing the components a
 * request to pick up: the target calculator may not even be mounted at the
 * time, and a hand-off consumed by whichever listener reacted first would race
 * as soon as more than one of them was alive.
 */
export const requestRestore = (entry: HistoryEntry) => {
  // The galaxy settings are part of the battle: restoring the ships without
  // them would quietly produce a different result.
  game.settings.specialGalaxy.defenderBonus = entry.game.defenderBonus;
  game.settings.conquest.capitalStarElimination =
    entry.game.capitalStarElimination;
  game.constants.star.homeStarDefenderBonusMultiplier =
    entry.game.homeStarDefenderBonusMultiplier;

  if (entry.kind === "basic") {
    loadBasicInput(clone(entry.input));
    isAdvanced.value = false;
  } else {
    replaceGroups(clone(entry.input.groups));
    isAdvanced.value = true;
  }
};

export const describeSides = (entry: HistoryEntry) =>
  entry.sides.map((s) => `${s.label} ${s.ships}`).join(" v ");
