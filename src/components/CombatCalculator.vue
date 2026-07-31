<!--
  Ported from solaris-games/solaris (GPL-3.0-or-later):
  client/src/views/game/components/combatcalculator/CombatCalculator.vue
-->
<template>
  <div class="menu-page container">
    <menu-title title="Combat Calculator">
      <a
        :href="documentationUrl"
        target="_blank"
        rel="noopener"
        class="btn btn-outline-info btn-sm"
        title="Documentation"
        ><i class="far fa-question-circle"></i
      ></a>
    </menu-title>

    <div class="form-check">
      <input
        class="form-check-input"
        type="checkbox"
        v-model="isAdvanced"
        id="chkCombatCalculatorAdvanced"
      />
      <label class="form-check-label" for="chkCombatCalculatorAdvanced">
        Advanced
      </label>
    </div>

    <game-settings />

    <basic-combat-calculator v-if="!isAdvanced" />
    <advanced-combat-calculator v-else />

    <footer class="pt-3 pb-3 mt-2 text-secondary">
      <small>
        An unofficial standalone port of the
        <a href="https://solaris.games" target="_blank" rel="noopener"
          >Solaris</a
        >
        combat calculator, built from the
        <a
          href="https://github.com/solaris-games/solaris"
          target="_blank"
          rel="noopener"
          >solaris-games/solaris</a
        >
        source and licensed under
        <a
          href="https://www.gnu.org/licenses/gpl-3.0.html"
          target="_blank"
          rel="noopener"
          >GPL-3.0-or-later</a
        >. Not affiliated with or endorsed by the Solaris team.
      </small>
    </footer>
  </div>
</template>

<script setup lang="ts">
import { ref } from "vue";
import MenuTitle from "@/components/MenuTitle.vue";
import GameSettings from "@/components/GameSettings.vue";
import BasicCombatCalculator from "@/components/BasicCombatCalculator.vue";
import AdvancedCombatCalculator from "@/components/AdvancedCombatCalculator.vue";

const isAdvanced = ref(false);

const documentationUrl =
  "https://solaris-games.github.io/solaris-docs/combat.html";
</script>

<style scoped>
footer a {
  color: inherit;
}
</style>
