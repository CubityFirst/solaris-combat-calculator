<!--
  Service worker status banner. `registerType: "prompt"` means a newly deployed
  version waits until the user accepts, so a deploy never swaps the page out
  from under a calculation in progress.
-->
<template>
  <div
    v-if="needRefresh || offlineReady"
    class="pwa-toast p-2"
    role="status"
    aria-live="polite"
  >
    <span v-if="needRefresh">A new version is available.</span>
    <span v-else>Ready to work offline.</span>

    <div class="pwa-toast-buttons">
      <button
        v-if="needRefresh"
        class="btn btn-sm btn-success"
        @click="updateServiceWorker(true)"
      >
        Reload
      </button>
      <button class="btn btn-sm btn-outline-secondary" @click="close">
        Dismiss
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useRegisterSW } from "virtual:pwa-register/vue";

const { offlineReady, needRefresh, updateServiceWorker } = useRegisterSW();

const close = () => {
  offlineReady.value = false;
  needRefresh.value = false;
};
</script>

<style scoped>
.pwa-toast {
  position: fixed;
  right: 16px;
  bottom: 16px;
  z-index: 1080;
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-width: calc(100vw - 32px);
  border: 1px solid var(--bs-border-color);
  border-radius: 4px;
  /* Lighter than the page, so the toast reads as floating above it. */
  background-color: var(--bs-secondary-bg);
  box-shadow: 0 2px 8px rgb(0 0 0 / 40%);
}

.pwa-toast-buttons {
  display: flex;
  flex-direction: row;
  gap: 8px;
}
</style>
