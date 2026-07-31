<!--
  Ported from solaris-games/solaris (GPL-3.0-or-later):
  client/src/views/game/components/MenuTitle.vue
  The close button is dropped - there is no menu to close in the standalone app.
-->
<template>
  <div class="row pt-2">
    <div class="col">
      <h4>{{ title }}</h4>
    </div>
    <div class="col-auto">
      <slot></slot>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  title: string;
}>();
</script>

<style scoped>
h3 {
  font-size: 1.8rem;
}
</style>
