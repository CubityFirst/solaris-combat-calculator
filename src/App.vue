<template>
  <main>
    <combat-calculator />
  </main>
</template>

<script setup lang="ts">
import CombatCalculator from "@/components/CombatCalculator.vue";
</script>

<style>
/* Ported from solaris-games/solaris (GPL-3.0-or-later): client/src/App.vue */

/* Animations */
@keyframes fadeInAnimation {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

.menu-page {
  opacity: 1;
  animation-name: fadeInAnimation;
  animation-duration: 0.3s;
  background-color: rgba(29, 40, 53, 0.98);
}

/* Scroll Bar */
/* Track */
::-webkit-scrollbar-track {
  background: #303030;
}

/* Handle */
::-webkit-scrollbar-thumb {
  background: #375a7f;
}

/* Option backgrounds are always white in Chrome */
option {
  background: rgba(29, 40, 53, 0.98);
}

.form-select option {
  color: unset !important;
}
</style>
