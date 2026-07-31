// A cut-down stand-in for solaris-games/solaris `common/src/types/common/game.ts`.
//
// The full Game type describes an entire live galaxy. The combat code only ever
// reads three values off it, so the standalone calculator models exactly those
// and nothing else. The shapes and defaults match the upstream Mongoose schema
// (server/db/models/schemas/game.ts) so results stay identical.
export type EnabledDisabled = "enabled" | "disabled";

export type Game = {
    settings: {
        specialGalaxy: {
            defenderBonus: EnabledDisabled;
        };
        conquest: {
            capitalStarElimination: EnabledDisabled;
        };
    };
    constants: {
        star: {
            homeStarDefenderBonusMultiplier: number;
        };
    };
};

export const defaultGame = (): Game => ({
    settings: {
        specialGalaxy: {
            defenderBonus: "enabled",
        },
        conquest: {
            capitalStarElimination: "disabled",
        },
    },
    constants: {
        star: {
            // Upstream schema default. Set to 2 by the "double home star defender
            // bonus" flux event (server/services/gameFlux.ts).
            homeStarDefenderBonusMultiplier: 1,
        },
    },
});
