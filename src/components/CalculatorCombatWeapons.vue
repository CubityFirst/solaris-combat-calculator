<!--
  Ported from solaris-games/solaris (GPL-3.0-or-later):
  client/src/views/game/components/combatcalculator/CalculatorCombatWeapons.vue

  In-game, "Players" is a multi-select of players in the galaxy. Standalone, the
  players in a group are added by hand. The combat code reads only their highest
  weapons level and how many of them there are (the ally count that drives Siege
  Breaker's per-ally buff), so this is equivalent.
-->
<template>
  <div v-if="model" class="p-2 mb-1 cg-weapons">
    <div class="cg-weapons-inputs input-group mb-1">
      <span class="input-group-text">
        <i class="fas fa-gun"></i>
      </span>
      <select
        class="form-select form-select-sm"
        :value="model.kind"
        @change="onKindChange"
      >
        <option value="level">Level</option>
        <option value="players">Players</option>
      </select>
      <input
        v-if="model.kind === 'level'"
        type="number"
        min="1"
        class="form-control form-control-sm"
        v-model.number="model.level"
      />
    </div>

    <template v-if="model.kind === 'players'">
      <div
        v-for="(player, idx) in model.players"
        :key="idx"
        class="input-group input-group-sm mb-1"
      >
        <span class="input-group-text">
          <i class="fas fa-user"></i>
        </span>
        <input
          type="text"
          class="form-control form-control-sm"
          placeholder="Alias"
          v-model="player.name"
        />
        <input
          type="number"
          min="1"
          class="form-control form-control-sm cg-weapons-level"
          placeholder="Weapons"
          v-model.number="player.weaponsLevel"
        />
        <button class="btn btn-sm btn-danger" @click="removePlayer(idx)">
          <i class="fas fa-times"></i>
        </button>
      </div>
      <button class="btn btn-sm btn-outline-info mb-1" @click="addPlayer">
        <i class="fas fa-plus"></i> Add Player
      </button>
      <p v-if="model.players?.length" class="mb-1">
        Effective level: {{ effectiveLevel }}
      </p>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import type { CCGroupWeaponsSpec } from "@/calculator/types";
import { technologyService } from "@/services";

const model = defineModel<CCGroupWeaponsSpec>({ required: true });

const onKindChange = (e: Event) => {
  const kind = (e.target as HTMLSelectElement).value;

  if (kind === "players" && model.value.kind !== "players") {
    model.value = { kind: "players", players: [] };
  } else if (kind === "level" && model.value.kind !== "level") {
    model.value = { kind: "level", level: 1 };
  }
};

const addPlayer = () => {
  if (model.value.kind !== "players") {
    return;
  }

  model.value.players.push({
    name: `Player ${model.value.players.length + 1}`,
    weaponsLevel: 1,
  });
};

const removePlayer = (idx: number) => {
  if (model.value.kind !== "players") {
    return;
  }

  model.value.players.splice(idx, 1);
};

const effectiveLevel = computed(() => {
  if (model.value.kind === "players") {
    return technologyService
      .getBaseWeapons(
        (model.value.players || []).map((p, idx) => ({
          _id: `p_${idx}`,
          research: { weapons: { level: p.weaponsLevel } },
        })),
      )
      .toString();
  }

  return "";
});
</script>

<style scoped>
.cg-weapons {
  border: 1px white solid;
  border-radius: 4px;
  display: flex;
  flex-direction: column;
}

.cg-weapons-inputs {
  display: flex;
  flex-direction: row;
}

.cg-weapons-level {
  max-width: 90px;
}
</style>
