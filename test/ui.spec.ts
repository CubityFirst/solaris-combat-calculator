// @vitest-environment jsdom
// Smoke tests: the ported components mount, accept input and render the result
// the engine produces.
import { describe, it, expect, beforeEach } from "vitest";
import { mount } from "@vue/test-utils";
import CombatCalculator from "../src/components/CombatCalculator.vue";
import BasicCombatCalculator from "../src/components/BasicCombatCalculator.vue";
import AdvancedCombatCalculator from "../src/components/AdvancedCombatCalculator.vue";
import { resetGameSettings } from "../src/stores/game";
import { useCombatCalculatorStore } from "../src/stores/combatCalculator";
import { combatService } from "../src/services";

beforeEach(() => {
  localStorage.clear();
  resetGameSettings();
  useCombatCalculatorStore().reset();
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
    const remaining = (text: string) =>
      Number(/wins with (\d+) ship/.exec(text)![1]);

    const withBonus = await fight(50, 1, 20, 1);

    const noBonusWrapper = mount(BasicCombatCalculator);
    await noBonusWrapper.find("#chkDefenderBonus").setValue(false);
    await noBonusWrapper.find("#defenderShips").setValue(50);
    await noBonusWrapper.find("#defenderWeaponTech").setValue(1);
    await noBonusWrapper.find("#attackerShips").setValue(20);
    await noBonusWrapper.find("#attackerWeaponTech").setValue(1);
    await noBonusWrapper.find("form").trigger("submit");

    expect(withBonus.text()).toContain("Defender wins with");
    expect(noBonusWrapper.text()).toContain("Defender wins with");

    // Firing at weapons 2 instead of 1, the star finishes the attackers in half
    // the rounds and so loses fewer of its own ships.
    expect(remaining(withBonus.text())).toBeGreaterThan(
      remaining(noBonusWrapper.text()),
    );
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
