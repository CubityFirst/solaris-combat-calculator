<!--
  New in the standalone port. In-game these three values come from the galaxy
  you're playing in; here they have to be entered. They are the only game
  settings the combat code reads (see solaris/services/technology.ts).
-->
<template>
  <div class="cg-settings p-2 mb-2">
    <div class="d-flex justify-content-between align-items-center">
      <h6 class="mb-0">
        <i class="fas fa-sliders-h me-1"></i> Game Settings
      </h6>
      <button
        class="btn btn-sm btn-outline-secondary"
        @click="expanded = !expanded"
      >
        <i class="fas" :class="expanded ? 'fa-chevron-up' : 'fa-chevron-down'"></i>
      </button>
    </div>

    <div v-if="expanded" class="mt-2">
      <div class="form-check">
        <input
          class="form-check-input"
          type="checkbox"
          id="chkGameDefenderBonus"
          :checked="game.settings.specialGalaxy.defenderBonus === 'enabled'"
          @change="setDefenderBonus"
        />
        <label class="form-check-label" for="chkGameDefenderBonus">
          Defender Bonus
          <small class="d-block text-secondary"
            >+1 weapons for the defending star.</small
          >
        </label>
      </div>

      <div class="form-check mt-2">
        <input
          class="form-check-input"
          type="checkbox"
          id="chkGameCapitalStarElimination"
          :checked="game.settings.conquest.capitalStarElimination === 'enabled'"
          @change="setCapitalStarElimination"
        />
        <label class="form-check-label" for="chkGameCapitalStarElimination">
          Capital Star Elimination
          <small class="d-block text-secondary"
            >Home stars get +1 defender bonus instead of the multiplier
            below.</small
          >
        </label>
      </div>

      <div class="row mt-2 align-items-center">
        <label for="homeStarMultiplier" class="col-8 col-form-label">
          Home Star Defender Bonus Multiplier
          <small class="d-block text-secondary"
            >Normally 1; the flux event sets it to 2.</small
          >
        </label>
        <div class="col-4">
          <input
            type="number"
            min="0"
            step="1"
            class="form-control form-control-sm"
            id="homeStarMultiplier"
            v-model.number="game.constants.star.homeStarDefenderBonusMultiplier"
          />
        </div>
      </div>

      <button class="btn btn-sm btn-outline-warning mt-2" @click="reset">
        Reset to defaults
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { game, resetGameSettings } from "@/stores/game";

const expanded = ref(false);

const setDefenderBonus = (e: Event) => {
  game.settings.specialGalaxy.defenderBonus = (e.target as HTMLInputElement)
    .checked
    ? "enabled"
    : "disabled";
};

const setCapitalStarElimination = (e: Event) => {
  game.settings.conquest.capitalStarElimination = (e.target as HTMLInputElement)
    .checked
    ? "enabled"
    : "disabled";
};

const reset = () => resetGameSettings();
</script>

<style scoped>
.cg-settings {
  border: 1px solid rgba(255, 255, 255, 0.25);
  border-radius: 4px;
}

.form-check-input,
.form-check-label {
  cursor: pointer;
}
</style>
