<!--
  HelloWorld.vue
  Placeholder landing component; to be replaced by the visualizer demos.
  Props:
  - msg: Heading text.
-->
<script setup lang="ts">
defineProps<{
  msg: string;
}>();
</script>

<template>
  <div class="flex flex-col items-center gap-4">
    <h1 class="text-3xl font-bold">{{ msg }}</h1>
    <p class="text-slate-600">Vue 3 + TypeScript + Vite + Tailwind CSS</p>
  </div>
</template>
