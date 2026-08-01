<!--
  Recent battles, newest first. Three are shown by default; the rest of the
  stored twenty are one click away. Selecting one loads its inputs - and the
  galaxy settings it was fought under - back into the calculator.
-->
<template>
  <div class="cg-history mt-3" v-if="entries.length">
    <div class="d-flex justify-content-between align-items-center mb-1">
      <h6 class="mb-0">
        <i class="fas fa-clock-rotate-left me-1"></i> Recent Combats
      </h6>
      <div class="d-flex gap-1">
        <button
          v-if="hasMoreEntries"
          class="btn btn-sm btn-outline-info"
          @click="expanded = !expanded"
        >
          {{ expanded ? "Show less" : `Show all ${entries.length}` }}
        </button>
        <button class="btn btn-sm btn-outline-secondary" @click="clearHistory">
          Clear
        </button>
      </div>
    </div>

    <ul class="list-unstyled mb-0">
      <li
        v-for="entry of visible"
        :key="entry.id"
        class="cg-history-entry p-2 mb-1"
      >
        <div class="cg-history-entry-main">
          <div>
            <span class="badge me-2" :class="badgeClass(entry)">{{
              entry.kind === "basic" ? "Basic" : "Advanced"
            }}</span>
            <span class="cg-history-sides">{{ describeSides(entry) }}</span>
          </div>
          <button
            class="btn btn-sm btn-outline-success"
            :title="`Load this battle back into the ${entry.kind} calculator`"
            @click="requestRestore(entry)"
          >
            <i class="fas fa-rotate-left me-1"></i> Load
          </button>
        </div>
        <small class="text-secondary">
          <span v-if="entry.winner">{{ entry.winner }} won</span>
          <span v-else>Mutual destruction</span>
          &middot; {{ formatTime(entry.at) }}
        </small>
      </li>
    </ul>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import {
  clearHistory,
  describeSides,
  entries,
  hasMoreEntries,
  recentEntries,
  requestRestore,
  type HistoryEntry,
} from "@/stores/combatHistory";

const expanded = ref(false);

const visible = computed(() =>
  expanded.value ? entries.value : recentEntries.value,
);

const badgeClass = (entry: HistoryEntry) =>
  entry.kind === "basic" ? "text-bg-secondary" : "text-bg-primary";

const formatTime = (at: number) =>
  new Date(at).toLocaleString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    day: "numeric",
    month: "short",
  });
</script>

<style scoped>
.cg-history-entry {
  border: 1px solid var(--bs-border-color);
  border-radius: 4px;
}

.cg-history-entry-main {
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
}

.cg-history-sides {
  word-break: break-word;
}
</style>
