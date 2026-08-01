// State for the basic calculator.
//
// It lives outside the component so a battle can be loaded straight back out of
// the history, without the component having to be mounted at the time.
import { ref } from "vue";
import type { BasicCombatResult } from "@/solaris/types/combat";

export type BasicSide = {
  ships: number;
  weaponsLevel: number;
};

export type BasicInput = {
  defender: BasicSide;
  attacker: BasicSide;
  isCarrierToStar: boolean;
  includeDefenderBonus: boolean;
};

export const defender = ref<BasicSide>({ ships: 0, weaponsLevel: 1 });
export const attacker = ref<BasicSide>({ ships: 0, weaponsLevel: 1 });
export const isCarrierToStar = ref(true);
export const includeDefenderBonus = ref(true);
export const result = ref<BasicCombatResult | null>(null);
export const errors = ref<string[]>([]);

export const loadBasicInput = (input: BasicInput) => {
  defender.value = { ...input.defender };
  attacker.value = { ...input.attacker };
  isCarrierToStar.value = input.isCarrierToStar;
  includeDefenderBonus.value = input.includeDefenderBonus;
  result.value = null;
  errors.value = [];
};

export const resetBasicCalculator = () => {
  loadBasicInput({
    defender: { ships: 0, weaponsLevel: 1 },
    attacker: { ships: 0, weaponsLevel: 1 },
    isCarrierToStar: true,
    includeDefenderBonus: true,
  });
};
