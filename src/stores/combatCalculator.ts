// Ported from solaris-games/solaris (GPL-3.0-or-later):
// client/src/stores/combatCalculator.ts
// Same behaviour, written as a plain reactive module instead of a pinia store
// so the standalone app doesn't need pinia.
import { ref } from "vue";
import type { CCGroup } from "@/calculator/types";

const groups = ref<CCGroup[]>([]);

const addGroup = () => {
  groups.value.push({
    name: `Group ${groups.value.length + 1}`,
    star: undefined,
    carriers: [],
    weapons: { kind: "level", level: 1 },
  });
};

const removeGroup = (group: CCGroup) => {
  const index = groups.value.indexOf(group);
  if (index !== -1) {
    groups.value.splice(index, 1);
  }
};

const reset = () => {
  groups.value = [];
};

export const useCombatCalculatorStore = () => ({
  groups,
  addGroup,
  removeGroup,
  reset,
});
