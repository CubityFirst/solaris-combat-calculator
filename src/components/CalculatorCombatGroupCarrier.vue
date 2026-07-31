<!--
  Ported from solaris-games/solaris (GPL-3.0-or-later):
  client/src/views/game/components/combatcalculator/CalculatorCombatGroupCarrier.vue
  The "pick a carrier off the map" button is dropped - there is no map.
-->
<template>
  <calculator-combat-group-object @onRemove="remove">
    <template v-slot:icon>
      <i class="fas fa-rocket"></i>
    </template>
    <template v-slot:inputs>
      <div class="input-group mb-1">
        <span class="input-group-text">
          <i class="fas fa-rocket"></i>
        </span>
        <input
          type="number"
          class="form-control form-control-sm ships-input"
          v-model.number="model.ships"
          min="0"
          placeholder="Ships"
        />
      </div>
      <specialist-selection kind="carrier" v-model="model.specialistId" />
    </template>
  </calculator-combat-group-object>
</template>

<script setup lang="ts">
import type { CCCarrier } from "@/calculator/types";
import CalculatorCombatGroupObject from "@/components/CalculatorCombatGroupObject.vue";
import SpecialistSelection from "@/components/SpecialistSelection.vue";

const emit = defineEmits<{
  onRemove: [carrier: CCCarrier];
}>();

const model = defineModel<CCCarrier>({ required: true });

const remove = () => emit("onRemove", model.value);
</script>

<style scoped></style>
