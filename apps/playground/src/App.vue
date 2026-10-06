<!--
  App.vue
  Playground shell. Interactive demos are added here as the core and
  element packages land.
-->
<script setup lang="ts">
import { PROTOCOL_VERSION } from '@algoviz/spec';
</script>

<template>
  <main class="mx-auto flex min-h-screen max-w-3xl flex-col gap-4 px-4 py-12">
    <h1 class="text-3xl font-bold">algoviz playground</h1>
    <p class="text-slate-600">
      Protocol version {{ PROTOCOL_VERSION }}. Demos will appear here once the
      core engine and the player elements are available.
    </p>
  </main>
</template>
