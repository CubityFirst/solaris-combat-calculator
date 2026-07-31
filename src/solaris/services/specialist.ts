// Standalone equivalent of solaris-games/solaris server/services/specialist.ts.
// The upstream service reads the same specialists.json (bundled here verbatim)
// and exposes it by id; everything about hiring/banning/costs is irrelevant to
// the calculator and has been dropped.
import specialists from "../config/specialists.json";
import type { Specialist, SpecialistType } from "../types/specialist";

const data = specialists as unknown as {
    carrier: Specialist[];
    star: Specialist[];
};

export interface ISpecialistService {
    getByIdStar(id: number): Specialist | null;

    getByIdCarrier(id: number): Specialist | null;
}

export class SpecialistService implements ISpecialistService {
    getByIdCarrier(id: number): Specialist | null {
        return data.carrier.find((s) => s.id === id) || null;
    }

    getByIdStar(id: number): Specialist | null {
        return data.star.find((s) => s.id === id) || null;
    }

    getAll(kind: SpecialistType): Specialist[] {
        return kind === "carrier" ? data.carrier : data.star;
    }

    /**
     * Specialists that can change the outcome of a battle. Everything else
     * (economy, scanning, warp gates, ...) is inert in the calculator, so the
     * dropdowns only offer these.
     */
    getCombatRelevant(kind: SpecialistType): Specialist[] {
        return this.getAll(kind).filter((s) => {
            const local = s.modifiers.local;
            const special = s.modifiers.special;

            return Boolean(
                local?.weapons ||
                    local?.carrierToCarrierCombat?.weapons ||
                    local?.carrierToStarCombat ||
                    special?.deductEnemyWeapons ||
                    special?.defenderBonus,
            );
        });
    }
}
