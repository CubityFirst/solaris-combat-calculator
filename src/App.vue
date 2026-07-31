<template>
  <main>
    <combat-calculator />
    <pwa-update-prompt />
  </main>
</template>

<script setup lang="ts">
import CombatCalculator from "@/components/CombatCalculator.vue";
import PwaUpdatePrompt from "@/components/PwaUpdatePrompt.vue";
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

/* Upstream also sets a background colour here, to lift the panel off the star
   map behind it. Standalone there is nothing behind it, so it inherits the body
   and the page reads as a single surface. */
.menu-page {
  opacity: 1;
  animation-name: fadeInAnimation;
  animation-duration: 0.3s;
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
  background: #1d2835;
}

.form-select option {
  color: unset !important;
}
</style>
