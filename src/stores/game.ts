// Replaces the client's pinia game store. In-game these values come from the
// galaxy the player is looking at; standalone they are settings the user picks.
// They are persisted to localStorage so a refresh keeps your scenario setup.
import { reactive, watch } from "vue";
import { defaultGame, type Game } from "@/solaris/types/game";

const STORAGE_KEY = "solaris-combat-calculator:game-settings";

const load = (): Game => {
  const base = defaultGame();

  try {
    const raw = localStorage.getItem(STORAGE_KEY);

    if (!raw) {
      return base;
    }

    const stored = JSON.parse(raw) as Partial<{
      defenderBonus: Game["settings"]["specialGalaxy"]["defenderBonus"];
      capitalStarElimination: Game["settings"]["conquest"]["capitalStarElimination"];
      homeStarDefenderBonusMultiplier: number;
    }>;

    if (stored.defenderBonus) {
      base.settings.specialGalaxy.defenderBonus = stored.defenderBonus;
    }

    if (stored.capitalStarElimination) {
      base.settings.conquest.capitalStarElimination =
        stored.capitalStarElimination;
    }

    if (typeof stored.homeStarDefenderBonusMultiplier === "number") {
      base.constants.star.homeStarDefenderBonusMultiplier =
        stored.homeStarDefenderBonusMultiplier;
    }
  } catch {
    // Corrupt or unavailable storage - fall back to defaults.
  }

  return base;
};

export const game = reactive<Game>(load());

watch(
  game,
  (g) => {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          defenderBonus: g.settings.specialGalaxy.defenderBonus,
          capitalStarElimination: g.settings.conquest.capitalStarElimination,
          homeStarDefenderBonusMultiplier:
            g.constants.star.homeStarDefenderBonusMultiplier,
        }),
      );
    } catch {
      // Storage unavailable (private mode etc.) - settings just won't persist.
    }
  },
  { deep: true },
);

export const resetGameSettings = () => {
  const base = defaultGame();

  game.settings.specialGalaxy.defenderBonus =
    base.settings.specialGalaxy.defenderBonus;
  game.settings.conquest.capitalStarElimination =
    base.settings.conquest.capitalStarElimination;
  game.constants.star.homeStarDefenderBonusMultiplier =
    base.constants.star.homeStarDefenderBonusMultiplier;
};
