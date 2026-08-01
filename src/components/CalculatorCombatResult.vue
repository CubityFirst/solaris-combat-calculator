<!--
  Ported from solaris-games/solaris (GPL-3.0-or-later):
  client/src/views/game/components/combatcalculator/CalculatorCombatResult.vue
-->
<template>
  <div class="cg-result">
    <div class="cg-result-objects">
      <calculator-combat-result-group
        v-for="(attackGroup, index) in result.groups"
        :key="index"
        :groups="result.groups"
        :group="attackGroup"
        :groupIndex="index"
      ></calculator-combat-result-group>
    </div>

    <p class="text-success m-0" v-if="winner && winnerName">
      {{ winnerName }} wins the battle!
    </p>
    <p v-for="needed of neededForOthers" class="text-warning m-0">
      <span v-if="needed.needed === null" class="text-secondary">
        Group {{ result.groups.indexOf(needed.group) }} is too far behind to
        work out how many ships it would have needed.
      </span>
      <span v-else-if="needed.needed >= SHIPS_NEEDED_CEILING">
        Group {{ result.groups.indexOf(needed.group) }} needed more than 10,000
        ships to win.
      </span>
      <span v-else>
        Group {{ result.groups.indexOf(needed.group) }} needed
        {{ needed.needed }} ships to win.
      </span>
    </p>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import type {
  CombatBaseCarrier,
  CombatBasePlayer,
  CombatBaseStar,
  DetailedCombatResult,
} from "@/solaris/types/combat";
import CalculatorCombatResultGroup from "@/components/CalculatorCombatResultGroup.vue";
import { combatService } from "@/services";
// An answer of exactly the ceiling means the search never found a win, so it is
// reported as a lower bound rather than as a figure.
import { SHIPS_NEEDED_CEILING } from "@/solaris/services/combat";

const props = defineProps<{
  result: DetailedCombatResult<
    string,
    CombatBasePlayer<string>,
    CombatBaseStar<string>,
    CombatBaseCarrier<string>
  >;
}>();

const winner = computed(() => combatService.getWinnerDetailed(props.result));
const winnerName = computed(
  () => winner.value && `Group ${props.result.groups.indexOf(winner.value)}`,
);

const neededForOthers = computed(() => {
  return props.result.groups.flatMap((g) => {
    if (g !== winner.value) {
      const needed = combatService.estimateNeeded(
        props.result,
        g,
        g.star ? "eliminateOtherGroups" : "greaterThanZeroShips",
      );

      return [
        {
          group: g,
          needed,
        },
      ];
    }

    return [];
  });
});
</script>

<style scoped>
.cg-result-objects {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
</style>
