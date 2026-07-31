// Stands in for the game client's `useGameServices()` provider. Same services,
// wired up once at module scope because there is no game session to scope them to.
import { CombatService } from "@/solaris/services/combat";
import { GameTypeService } from "@/solaris/services/gameType";
import { SpecialistService } from "@/solaris/services/specialist";
import { TechnologyService } from "@/solaris/services/technology";

export const specialistService = new SpecialistService();
export const gameTypeService = new GameTypeService();
export const technologyService = new TechnologyService(
  specialistService,
  gameTypeService,
);
export const combatService = new CombatService<string>(
  technologyService,
  specialistService,
);
