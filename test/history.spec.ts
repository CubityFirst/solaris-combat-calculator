// @vitest-environment jsdom
// Combat history and the notepad: recording, the 3/20 split, persistence, and
// loading a battle back into the calculator it was fought in.
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { enableAutoUnmount, mount } from "@vue/test-utils";
import { nextTick } from "vue";
import CombatCalculator from "../src/components/CombatCalculator.vue";
import CombatHistory from "../src/components/CombatHistory.vue";
import BasicCombatCalculator from "../src/components/BasicCombatCalculator.vue";
import AdvancedCombatCalculator from "../src/components/AdvancedCombatCalculator.vue";
import Notepad from "../src/components/Notepad.vue";
import {
  addEntry,
  clearHistory,
  entries,
  HISTORY_LIMIT,
  HISTORY_PREVIEW,
} from "../src/stores/combatHistory";
import { notes } from "../src/stores/notepad";
import { useCombatCalculatorStore } from "../src/stores/combatCalculator";
import { game, resetGameSettings } from "../src/stores/game";
import { resetBasicCalculator } from "../src/stores/basicCalculator";
import { isAdvanced } from "../src/stores/ui";

// Components that stay mounted between tests keep live subscriptions to the
// shared stores, which is not how the app behaves.
enableAutoUnmount(afterEach);

const basicEntry = (n: number) => ({
  kind: "basic" as const,
  sides: [
    { label: "Defender", ships: n },
    { label: "Attacker", ships: n * 2 },
  ],
  winner: "Attacker",
  input: {
    defender: { ships: n, weaponsLevel: 1 },
    attacker: { ships: n * 2, weaponsLevel: 1 },
    isCarrierToStar: true,
    includeDefenderBonus: true,
  },
});

beforeEach(() => {
  localStorage.clear();
  clearHistory();
  resetGameSettings();
  useCombatCalculatorStore().reset();
  resetBasicCalculator();
  isAdvanced.value = false;
  notes.value = "";
});

/**
 * Restoring can cross a component boundary: the parent switches mode, the
 * calculator for that mode mounts, and only then does its watcher pick the
 * request up. That is several ticks, so wait for the queue to settle.
 */
const flush = async () => {
  for (let i = 0; i < 4; i++) {
    await nextTick();
  }
};

const fight = async (
  wrapper: any,
  defenderShips: number,
  attackerShips: number,
) => {
  await wrapper.find("#defenderShips").setValue(defenderShips);
  await wrapper.find("#defenderWeaponTech").setValue(1);
  await wrapper.find("#attackerShips").setValue(attackerShips);
  await wrapper.find("#attackerWeaponTech").setValue(1);
  await wrapper.find("form").trigger("submit");
};

describe("combat history store", () => {
  it("keeps the newest battle first and caps the list", () => {
    for (let i = 1; i <= HISTORY_LIMIT + 7; i++) {
      addEntry(basicEntry(i));
    }

    expect(entries.value.length).toBe(HISTORY_LIMIT);
    expect(entries.value[0].sides[0].ships).toBe(HISTORY_LIMIT + 7);
    expect(entries.value.at(-1)!.sides[0].ships).toBe(8);
  });

  it("records the galaxy settings the battle was fought under", () => {
    game.settings.specialGalaxy.defenderBonus = "disabled";
    game.constants.star.homeStarDefenderBonusMultiplier = 2;

    const entry = addEntry(basicEntry(10));

    expect(entry.game).toEqual({
      defenderBonus: "disabled",
      capitalStarElimination: "disabled",
      homeStarDefenderBonusMultiplier: 2,
    });
  });

  it("persists to localStorage", async () => {
    addEntry(basicEntry(4));
    await nextTick();

    const stored = JSON.parse(
      localStorage.getItem("solaris-combat-calculator:history")!,
    );

    expect(stored).toHaveLength(1);
    expect(stored[0].input.defender.ships).toBe(4);
  });

  it("copies inputs in, so later edits cannot alter a stored battle", () => {
    const input = basicEntry(5);

    const entry = addEntry(input);

    input.input.defender.ships = 999;

    expect((entry as any).input.defender.ships).toBe(5);
  });
});

describe("CombatHistory", () => {
  it("shows nothing until a battle has been fought", () => {
    const wrapper = mount(CombatHistory);

    expect(wrapper.text()).toBe("");
  });

  it("shows three battles, then all of them", async () => {
    for (let i = 1; i <= 8; i++) {
      addEntry(basicEntry(i));
    }

    const wrapper = mount(CombatHistory);

    expect(wrapper.findAll("li")).toHaveLength(HISTORY_PREVIEW);
    expect(wrapper.text()).toContain("Show all 8");

    await wrapper.findAll("button").find((b) => b.text().includes("Show all"))!.trigger("click");

    expect(wrapper.findAll("li")).toHaveLength(8);

    await wrapper.findAll("button").find((b) => b.text() === "Show less")!.trigger("click");

    expect(wrapper.findAll("li")).toHaveLength(HISTORY_PREVIEW);
  });

  it("summarises the ships each side brought and who won", () => {
    addEntry(basicEntry(12));

    const wrapper = mount(CombatHistory);

    expect(wrapper.text()).toContain("Defender 12 v Attacker 24");
    expect(wrapper.text()).toContain("Attacker won");
  });

  it("clears the list", async () => {
    addEntry(basicEntry(3));

    const wrapper = mount(CombatHistory);

    await wrapper.findAll("button").find((b) => b.text() === "Clear")!.trigger("click");

    expect(entries.value).toHaveLength(0);
  });
});

describe("recording battles", () => {
  it("records a basic battle when it is fought", async () => {
    const wrapper = mount(BasicCombatCalculator);

    await fight(wrapper, 10, 50);

    expect(entries.value).toHaveLength(1);

    const entry = entries.value[0];

    expect(entry.kind).toBe("basic");
    expect(entry.sides).toEqual([
      { label: "Defender", ships: 10 },
      { label: "Attacker", ships: 50 },
    ]);
    expect(entry.winner).toBe("Attacker");
  });

  it("records an advanced battle with one side per group", async () => {
    const store = useCombatCalculatorStore();

    store.addGroup();
    store.addGroup();
    store.groups.value[0].star = {
      ships: 100,
      specialistId: null,
      isHomeStar: false,
      isAsteroidField: false,
    };
    store.groups.value[1].carriers = [{ ships: 10, specialistId: null }];

    const wrapper = mount(AdvancedCombatCalculator);

    await wrapper.findAll("button").find((b) => b.text() === "Calculate")!.trigger("click");

    expect(entries.value).toHaveLength(1);

    const entry = entries.value[0];

    expect(entry.kind).toBe("advanced");
    expect(entry.sides).toEqual([
      { label: "Group 0", ships: 100 },
      { label: "Group 1", ships: 10 },
    ]);
    expect(entry.winner).toBe("Group 0");
  });
});

describe("loading a battle back in", () => {
  it("puts a basic battle back on the form", async () => {
    const wrapper = mount(CombatCalculator);

    const basic = () => wrapper.findComponent(BasicCombatCalculator);

    await fight(basic(), 15, 40);

    // Type over it, as a user would before deciding to go back.
    await basic().find("#defenderShips").setValue(1);
    await basic().find("#attackerShips").setValue(2);

    await wrapper
      .findAll("button")
      .find((b) => b.text().includes("Load"))!
      .trigger("click");
    await flush();

    expect(
      (basic().find("#defenderShips").element as HTMLInputElement).value,
    ).toBe("15");
    expect(
      (basic().find("#attackerShips").element as HTMLInputElement).value,
    ).toBe("40");
  });

  it("switches to the advanced calculator and restores its groups", async () => {
    const store = useCombatCalculatorStore();

    store.addGroup();
    store.addGroup();
    store.groups.value[0].weapons = { kind: "level", level: 7 };
    store.groups.value[0].carriers = [{ ships: 33, specialistId: 2 }];
    store.groups.value[1].carriers = [{ ships: 21, specialistId: null }];

    const wrapper = mount(CombatCalculator);

    await wrapper.find("#chkCombatCalculatorAdvanced").setValue(true);
    await wrapper
      .findAll("button")
      .find((b) => b.text() === "Calculate")!
      .trigger("click");

    // Back to basic, and wipe the working state.
    await wrapper.find("#chkCombatCalculatorAdvanced").setValue(false);
    store.reset();

    expect(wrapper.findComponent(AdvancedCombatCalculator).exists()).toBe(false);

    await wrapper
      .findAll("button")
      .find((b) => b.text().includes("Load"))!
      .trigger("click");
    await flush();

    expect(wrapper.findComponent(AdvancedCombatCalculator).exists()).toBe(true);
    expect(store.groups.value).toHaveLength(2);
    expect(store.groups.value[0].carriers[0]).toEqual({
      ships: 33,
      specialistId: 2,
    });
    expect(store.groups.value[0].weapons).toEqual({ kind: "level", level: 7 });
    expect(store.groups.value[1].carriers[0].ships).toBe(21);
  });

  it("restores the galaxy settings the battle was fought under", async () => {
    game.settings.specialGalaxy.defenderBonus = "disabled";
    game.constants.star.homeStarDefenderBonusMultiplier = 2;

    addEntry(basicEntry(6));

    resetGameSettings();
    expect(game.settings.specialGalaxy.defenderBonus).toBe("enabled");

    const wrapper = mount(CombatHistory);

    await wrapper
      .findAll("button")
      .find((b) => b.text().includes("Load"))!
      .trigger("click");

    expect(game.settings.specialGalaxy.defenderBonus).toBe("disabled");
    expect(game.constants.star.homeStarDefenderBonusMultiplier).toBe(2);
  });

  it("leaves the stored battle intact when the restored one is edited", async () => {
    const store = useCombatCalculatorStore();

    store.addGroup();
    store.groups.value[0].carriers = [{ ships: 50, specialistId: null }];
    store.addGroup();
    store.groups.value[1].carriers = [{ ships: 5, specialistId: null }];

    const wrapper = mount(AdvancedCombatCalculator);
    await wrapper.findAll("button").find((b) => b.text() === "Calculate")!.trigger("click");

    store.groups.value[0].carriers[0].ships = 999;

    expect(
      (entries.value[0] as any).input.groups[0].carriers[0].ships,
    ).toBe(50);
  });
});

describe("Notepad", () => {
  it("saves what is typed and reloads it", async () => {
    const wrapper = mount(Notepad);

    await wrapper.find("textarea").setValue("watch out for the siege breaker");
    await nextTick();

    expect(localStorage.getItem("solaris-combat-calculator:notes")).toBe(
      "watch out for the siege breaker",
    );

    // A fresh mount reads the same store, as a reload would.
    expect(mount(Notepad).find("textarea").element.value).toBe(
      "watch out for the siege breaker",
    );
  });

  it("clears the notes", async () => {
    notes.value = "some notes";

    const wrapper = mount(Notepad);

    await wrapper.find("button").trigger("click");

    expect(notes.value).toBe("");
    expect(wrapper.find("textarea").element.value).toBe("");
  });
});
