<!--
  Ported from solaris-games/solaris (GPL-3.0-or-later):
  client/src/views/game/components/combatcalculator/CalculatorCombatGroup.vue
-->
<template>
  <div class="cg-box p-2" :class="hasError ? 'cg-box-error' : 'cg-box-ok'">
    <h5>Group {{ index }}</h5>
    <calculator-combat-weapons v-model="model.weapons" />
    <div class="cg-box-objects mb-1">
      <calculator-combat-group-star
        v-if="model.star"
        v-model="model.star"
        @onRemove="removeStar"
      />
      <calculator-combat-group-carrier
        v-for="(carrier, idx) in model.carriers"
        :key="idx"
        v-model="model.carriers[idx]"
        @onRemove="removeCarrier"
      />
    </div>
    <div class="cg-box-group">
      <button
        class="btn btn-success btn-sm"
        :disabled="Boolean(model.star) || otherGroupHasStar"
        @click="addStar"
      >
        Add Star
      </button>
      <button class="btn btn-success btn-sm" @click="addCarrier">
        Add Carrier
      </button>
      <button class="btn btn-danger btn-sm" @click="remove">Delete</button>
    </div>
    <div class="cg-box-footer mt-1" v-if="validationErrors.length">
      <p v-for="err of validationErrors" class="text-danger">{{ err }}</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import CalculatorCombatGroupStar from "@/components/CalculatorCombatGroupStar.vue";
import CalculatorCombatGroupCarrier from "@/components/CalculatorCombatGroupCarrier.vue";
import CalculatorCombatWeapons from "@/components/CalculatorCombatWeapons.vue";
import type { CCCarrier, CCGroup } from "@/calculator/types";

const props = defineProps<{
  validationErrors: string[];
  groups: CCGroup[];
  index: number;
}>();

const emit = defineEmits<{
  onGroupRemove: [group: CCGroup];
}>();

const model = defineModel<CCGroup>({ required: true });

const hasError = computed(() => props.validationErrors.length > 0);

const remove = () => emit("onGroupRemove", model.value!);

const otherGroupHasStar = computed(() =>
  Boolean(props.groups.find((g) => g !== model.value && g.star)),
);

const removeStar = () => {
  model.value!.star = undefined;
};

const removeCarrier = (c: CCCarrier) => {
  model.value.carriers.splice(model.value.carriers.indexOf(c), 1);
};

const addStar = () => {
  model.value!.star = {
    ships: 0,
    specialistId: null,
    isHomeStar: false,
    isAsteroidField: false,
  };
};

const addCarrier = () => {
  model.value!.carriers.push({
    ships: 0,
    specialistId: null,
  });
};
</script>

<style scoped>
.cg-box {
  display: flex;
  flex-direction: column;
  border: blue 2px solid;
  border-radius: 4px;
}

.cg-box-error {
  border-color: red;
}

.cg-box-ok {
  border-color: blue;
}

.cg-box-group {
  display: flex;
  flex-direction: row;
  gap: 4px;
}

.cg-box-objects {
  display: flex;
  flex-direction: row;
  flex-wrap: wrap;
  justify-content: space-evenly;
  gap: 4px;
}
</style>
