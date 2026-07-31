<!--
  Ported from solaris-games/solaris (GPL-3.0-or-later):
  client/src/views/game/components/combatcalculator/CalculatorCombatGroupStar.vue
  The "pick a star off the map" button is dropped - there is no map.
-->
<template>
  <calculator-combat-group-object @onRemove="remove">
    <template v-slot:icon>
      <i class="fas fa-star"></i>
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
      <specialist-selection kind="star" v-model="model.specialistId" />
      <div class="form-check mb-1">
        <label class="form-check-label">
          Home Star
          <input
            class="form-check-input"
            type="checkbox"
            v-model="model.isHomeStar"
          />
        </label>
      </div>
      <div class="form-check mb-1">
        <label class="form-check-label">
          Asteroid Field
          <input
            class="form-check-input"
            type="checkbox"
            v-model="model.isAsteroidField"
          />
        </label>
      </div>
    </template>
  </calculator-combat-group-object>
</template>

<script setup lang="ts">
import type { CCStar } from "@/calculator/types";
import CalculatorCombatGroupObject from "@/components/CalculatorCombatGroupObject.vue";
import SpecialistSelection from "@/components/SpecialistSelection.vue";

const emit = defineEmits<{
  onRemove: [];
}>();

const model = defineModel<CCStar>({ required: true });

const remove = () => emit("onRemove");
</script>

<style scoped></style>
