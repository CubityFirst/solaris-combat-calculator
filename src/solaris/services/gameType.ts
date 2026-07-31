// Ported from solaris-games/solaris (GPL-3.0-or-later): common/src/services/gameType.ts
// Only the predicate consulted by the combat/technology code is kept.
import type { Game } from "../types/game";

export class GameTypeService {
    isCapitalStarEliminationMode(game: Game) {
        return game.settings.conquest.capitalStarElimination === "enabled";
    }
}
