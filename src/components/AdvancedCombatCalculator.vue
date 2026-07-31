<!--
  Ported from solaris-games/solaris (GPL-3.0-or-later):
  client/src/views/game/components/combatcalculator/AdvancedCombatCalculator.vue
-->
<template>
  <div class="p-2 row cg-groups">
    <calculator-combat-group
      @onGroupRemove="onGroupRemoved"
      v-for="(group, index) in groups"
      :key="index"
      v-model="groups[index]"
      :index="index"
      :groups="groups"
      :validation-errors="getErrors(group)"
    />
  </div>
  <div class="p-2 row">
    <p v-for="err of errors" class="text-danger">{{ err }}</p>
  </div>
  <hr class="m-0" v-if="result" />
  <div class="p-2 row" v-if="result">
    <calculator-combat-result :result="result" />
  </div>
  <div class="p-2 cg-buttons">
    <button class="btn btn-success" @click="addGroup">Add Group</button>
    <button class="btn btn-primary" :disabled="hasErrors" @click="calculate">
      Calculate
    </button>
    <button class="btn btn-warning" @click="reset">Reset</button>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from "vue";
import CalculatorCombatGroup from "@/components/CalculatorCombatGroup.vue";
import CalculatorCombatResult from "@/components/CalculatorCombatResult.vue";
import type {
  CombatBaseCarrier,
  CombatBasePlayer,
  CombatBaseStar,
  DetailedCombatResult,
} from "@/solaris/types/combat";
import { type CCGroup, makeCombatGroups } from "@/calculator/types";
import { useCombatCalculatorStore } from "@/stores/combatCalculator";
import { combatService } from "@/services";
import { game } from "@/stores/game";

const combatCalculatorStore = useCombatCalculatorStore();

const { groups } = combatCalculatorStore;
const result = ref<DetailedCombatResult<
  string,
  CombatBasePlayer<string>,
  CombatBaseStar<string>,
  CombatBaseCarrier<string>
> | null>(null);

const errors = computed(() => {
  if (groups.value.length < 2) {
    return ["Need at least 2 groups to calculate combat."];
  }

  return [];
});

// Upstream only blocks on the global errors; per-group errors are shown but the
// Calculate button stays live, which throws on e.g. a group with no objects.
// Blocking on them too changes no result, it just avoids the crash.
const hasErrors = computed(
  () =>
    errors.value.length > 0 ||
    groups.value.some((g) => getErrors(g).length > 0),
);

const onGroupRemoved = (gr: CCGroup) => {
  combatCalculatorStore.removeGroup(gr);
};

const addGroup = () => {
  combatCalculatorStore.addGroup();
};

const getErrors = (group: CCGroup) => {
  const errors: string[] = [];

  if (!group.star && !group.carriers.length) {
    errors.push("Group needs at least 1 object");
  }

  if (group.weapons.kind === "level" && group.weapons.level < 1) {
    errors.push("Weapons level needs to be at least 1");
  }

  if (group.weapons.kind === "players" && !group.weapons.players?.length) {
    errors.push("At least one player needs to be selected for weapons level");
  }

  return errors;
};

const reset = () => {
  combatCalculatorStore.reset();
  result.value = null;
};

const calculate = () => {
  const actualCombatGroups = makeCombatGroups(
    game,
    groups.value,
    combatService,
  );

  result.value = combatService.calculateGroups(
    actualCombatGroups,
    groups.value.some((g) => Boolean(g.star)),
  );
};
</script>

<style scoped>
.cg-groups {
  gap: 4px;
}

.cg-buttons {
  display: flex;
  flex-direction: row;
  gap: 4px;
}
</style>
