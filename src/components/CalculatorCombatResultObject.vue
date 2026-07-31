<!--
  Ported from solaris-games/solaris (GPL-3.0-or-later):
  client/src/views/game/components/combatcalculator/CalculatorCombatResultObject.vue
-->
<template>
  <tr>
    <td><slot></slot></td>
    <td>{{ object.shipsBefore }}</td>
    <td>{{ object.shipsLost }}</td>
    <td>{{ object.shipsAfter }}</td>
  </tr>
</template>

<script setup lang="ts">
import type { DetailedCombatResultObject } from "@/solaris/types/combat";

defineProps<{
  object: DetailedCombatResultObject;
}>();
</script>

<style scoped></style>
