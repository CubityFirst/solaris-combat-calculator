// @vitest-environment jsdom
// Smoke tests: the ported components mount, accept input and render the result
// the engine produces.
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { enableAutoUnmount, mount } from "@vue/test-utils";
import CombatCalculator from "../src/components/CombatCalculator.vue";
import BasicCombatCalculator from "../src/components/BasicCombatCalculator.vue";
import AdvancedCombatCalculator from "../src/components/AdvancedCombatCalculator.vue";
import { resetGameSettings } from "../src/stores/game";
import { useCombatCalculatorStore } from "../src/stores/combatCalculator";
import { resetBasicCalculator } from "../src/stores/basicCalculator";
import { clearHistory } from "../src/stores/combatHistory";
import { isAdvanced } from "../src/stores/ui";
import { combatService } from "../src/services";

// The calculators read shared stores, so a component left mounted from an
// earlier test would still be reacting to them.
enableAutoUnmount(afterEach);

beforeEach(() => {
  localStorage.clear();
  resetGameSettings();
  useCombatCalculatorStore().reset();
  resetBasicCalculator();
  clearHistory();
  isAdvanced.value = false;
});

describe("CombatCalculator", () => {
  it("renders the basic calculator and switches to advanced", async () => {
    const wrapper = mount(CombatCalculator);

    expect(wrapper.text()).toContain("Combat Calculator");
    expect(wrapper.findComponent(BasicCombatCalculator).exists()).toBe(true);

    await wrapper.find("#chkCombatCalculatorAdvanced").setValue(true);

    expect(wrapper.findComponent(AdvancedCombatCalculator).exists()).toBe(true);
  });
});

describe("BasicCombatCalculator", () => {
  const fight = async (
    defenderShips: number,
    defenderWeapons: number,
    attackerShips: number,
    attackerWeapons: number,
  ) => {
    const wrapper = mount(BasicCombatCalculator);

    await wrapper.find("#defenderShips").setValue(defenderShips);
    await wrapper.find("#defenderWeaponTech").setValue(defenderWeapons);
    await wrapper.find("#attackerShips").setValue(attackerShips);
    await wrapper.find("#attackerWeaponTech").setValue(attackerWeapons);
    await wrapper.find("form").trigger("submit");

    return wrapper;
  };

  it("renders exactly what the engine computes for an attacker win", async () => {
    const wrapper = await fight(10, 1, 50, 1);

    // Defender bonus defaults to on, so the star fights at weapons 1 + 1.
    const expected = combatService.calculateBasic(
      { ships: 10, weaponsLevel: 1 },
      { ships: 50, weaponsLevel: 1 },
      true,
      true,
    );

    expect(expected.attacker.shipsAfter).toBeGreaterThan(
      expected.defender.shipsAfter,
    );
    expect(wrapper.text()).toContain(
      `Attacker wins with ${expected.attacker.shipsAfter} ship(s) remaining`,
    );
    expect(wrapper.text()).toContain(
      `Defender would need ${expected.defender.shipsNeeded} ship(s) to win`,
    );
  });

  it("renders exactly what the engine computes for a defender win", async () => {
    const wrapper = await fight(50, 1, 10, 1);

    const expected = combatService.calculateBasic(
      { ships: 50, weaponsLevel: 1 },
      { ships: 10, weaponsLevel: 1 },
      true,
      true,
    );

    expect(wrapper.text()).toContain(
      `Defender wins with ${expected.defender.shipsAfter} ship(s) remaining`,
    );
    expect(wrapper.text()).toContain(
      `Attacker would need ${expected.attacker.shipsNeeded} ship(s) to win`,
    );
  });

  it("applies the defender bonus checkbox", async () => {
    // Fought in one calculator, twice: the form state is shared, so two mounts
    // would be looking at the same battle.
    const wrapper = await fight(50, 1, 20, 1);

    const remaining = () =>
      Number(/wins with (\d+) ship/.exec(wrapper.text())![1]);

    expect(wrapper.text()).toContain("Defender wins with");
    const withBonus = remaining();

    await wrapper.find("#chkDefenderBonus").setValue(false);
    await wrapper.find("form").trigger("submit");

    expect(wrapper.text()).toContain("Defender wins with");
    const withoutBonus = remaining();

    // Firing at weapons 2 instead of 1, the star finishes the attackers in half
    // the rounds and so loses fewer of its own ships.
    expect(withBonus).toBeGreaterThan(withoutBonus);
  });

  it("swaps the two sides", async () => {
    const wrapper = mount(BasicCombatCalculator);

    await wrapper.find("#defenderShips").setValue(7);
    await wrapper.find("#attackerShips").setValue(3);
    await wrapper.find("button[title='Swap the defender/attacker values']").trigger("click");

    expect(
      (wrapper.find("#defenderShips").element as HTMLInputElement).value,
    ).toBe("3");
    expect(
      (wrapper.find("#attackerShips").element as HTMLInputElement).value,
    ).toBe("7");
  });

  it("rejects a zero weapons level", async () => {
    const wrapper = mount(BasicCombatCalculator);

    await wrapper.find("#defenderWeaponTech").setValue(0);
    await wrapper.find("#attackerShips").setValue(10);
    await wrapper.find("form").trigger("submit");

    expect(wrapper.text()).toContain(
      "Defender weapons level must be greater than 0.",
    );
  });
});

describe("AdvancedCombatCalculator", () => {
  it("needs two groups before it will calculate", async () => {
    const wrapper = mount(AdvancedCombatCalculator);

    expect(wrapper.text()).toContain("Need at least 2 groups");

    const calculate = wrapper
      .findAll("button")
      .find((b) => b.text() === "Calculate")!;

    expect(calculate.attributes("disabled")).toBeDefined();
  });

  it("calculates a star vs carrier battle and names the winner", async () => {
    const store = useCombatCalculatorStore();

    store.addGroup();
    store.addGroup();

    store.groups.value[0].weapons = { kind: "level", level: 1 };
    store.groups.value[0].star = {
      ships: 100,
      specialistId: null,
      isHomeStar: false,
      isAsteroidField: false,
    };
    store.groups.value[1].weapons = { kind: "level", level: 1 };
    store.groups.value[1].carriers = [{ ships: 10, specialistId: null }];

    const wrapper = mount(AdvancedCombatCalculator);

    await wrapper
      .findAll("button")
      .find((b) => b.text() === "Calculate")!
      .trigger("click");

    expect(wrapper.text()).toContain("Group 0 wins the battle!");
    expect(wrapper.text()).toMatch(/Group 1 needed \d+ ships to win/);
  });

  it("adds and removes groups and objects through the UI", async () => {
    const wrapper = mount(AdvancedCombatCalculator);
    const store = useCombatCalculatorStore();

    const click = async (label: string) =>
      wrapper
        .findAll("button")
        .find((b) => b.text() === label)!
        .trigger("click");

    await click("Add Group");
    expect(store.groups.value.length).toBe(1);

    await click("Add Carrier");
    expect(store.groups.value[0].carriers.length).toBe(1);

    await click("Add Star");
    expect(store.groups.value[0].star).toBeDefined();

    await click("Delete");
    expect(store.groups.value.length).toBe(0);
  });
});
