<!--
  Ported from solaris-games/solaris (GPL-3.0-or-later):
  client/src/views/game/components/combatcalculator/SpecialistSelection.vue

  In-game the list comes from the server (filtered by the game's ban list). Here
  it comes from the bundled specialists.json, narrowed to the specialists that
  can actually affect combat.
-->
<template>
  <div class="input-group mb-1">
    <span class="input-group-text">
      <i class="fas fa-user-astronaut"></i>
    </span>
    <select class="form-select form-select-sm" v-model="model">
      <option :value="null">None</option>
      <option v-for="s in specialists" :key="s.id" :value="s.id">
        {{ s.name }}
      </option>
    </select>
  </div>
  <p v-if="selected" class="cg-spec-description mb-1">
    {{ selected.description }}
  </p>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { specialistService } from "@/services";

const model = defineModel<number | null>();

const props = defineProps<{
  kind: "carrier" | "star";
}>();

const specialists = computed(() =>
  specialistService.getCombatRelevant(props.kind),
);

const selected = computed(
  () => specialists.value.find((s) => s.id === model.value) || null,
);
</script>

<style scoped>
.cg-spec-description {
  font-size: 0.75rem;
  opacity: 0.7;
}
</style>
