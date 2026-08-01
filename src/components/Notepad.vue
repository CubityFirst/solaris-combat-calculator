<!--
  A scratch pad for working notes - enemy tech levels, what to send where.
  Plain text only, saved to localStorage as you type.
-->
<template>
  <div class="cg-notepad mt-3">
    <div class="d-flex justify-content-between align-items-center mb-1">
      <h6 class="mb-0">
        <label for="notepad">
          <i class="fas fa-pen-to-square me-1"></i> Notes
        </label>
      </h6>
      <button
        class="btn btn-sm btn-outline-secondary"
        :disabled="!notes.length"
        @click="notes = ''"
      >
        Clear
      </button>
    </div>
    <textarea
      id="notepad"
      class="form-control form-control-sm"
      rows="4"
      placeholder="Scratch notes - saved automatically."
      v-model="notes"
    ></textarea>
  </div>
</template>

<script setup lang="ts">
import { notes } from "@/stores/notepad";
</script>

<style scoped>
textarea {
  resize: vertical;
}
</style>
