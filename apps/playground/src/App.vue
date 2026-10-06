<!--
  App.vue
  Playground: steps through a recorded bubble sort using the real pipeline
  (spec → core → layout → svg).
-->
<script setup lang="ts">
import { computed, ref } from 'vue';

import { formatErrors } from '@algoviz/spec';
import { layoutTrace, loadTrace } from '@algoviz/core';
import { renderSvg, type ThemeName } from '@algoviz/svg';

import { bubbleSort } from './samples/bubble-sort';

const loaded = loadTrace(bubbleSort([5, 3, 8, 1, 4]));
const trace = loaded.ok ? loaded.value : null;
const error = loaded.ok ? '' : formatErrors(loaded.error);
const layout = trace ? layoutTrace(trace) : null;

const index = ref(0);
const theme = ref<ThemeName>('light');
const themeNames: ThemeName[] = ['light', 'dark', 'print'];
const length = trace?.length ?? 0;
// renderSvg escapes all text, so the markup is safe to insert.
const svg = computed(() =>
  layout
    ? renderSvg(layout.sceneAt(index.value), {
        scale: 1.25,
        theme: theme.value,
      })
    : '',
);
const narration = computed(
  () => trace?.frame(index.value).step?.meta?.narration ?? 'Initial state.',
);

const go = (delta: number) => {
  index.value = Math.min(length, Math.max(0, index.value + delta));
};
</script>

<template>
  <main class="mx-auto flex min-h-screen max-w-3xl flex-col gap-4 px-4 py-12">
    <h1 class="text-3xl font-bold">algoviz playground</h1>
    <pre v-if="error" class="text-red-700">{{ error }}</pre>
    <template v-else>
      <!-- eslint-disable vue/no-v-html -- output of renderSvg, which escapes all text -->
      <div
        class="overflow-x-auto rounded-lg p-4"
        :class="
          theme === 'dark' ? 'bg-[#121816]' : 'bg-white ring-1 ring-slate-200'
        "
        data-testid="scene"
        v-html="svg"
      />
      <!-- eslint-enable vue/no-v-html -->
      <p class="min-h-6" data-testid="narration">{{ narration }}</p>
      <div class="flex flex-wrap items-center gap-3">
        <button
          class="rounded border px-3 py-1"
          type="button"
          :disabled="index === 0"
          @click="go(-1)"
        >
          Previous
        </button>
        <button
          class="rounded border px-3 py-1"
          type="button"
          :disabled="index === length"
          @click="go(1)"
        >
          Next
        </button>
        <input
          v-model.number="index"
          class="min-w-32 flex-1"
          type="range"
          min="0"
          :max="length"
          aria-label="Timeline"
        />
        <select
          v-model="theme"
          class="rounded border px-2 py-1"
          aria-label="Theme"
        >
          <option v-for="name in themeNames" :key="name" :value="name">
            {{ name }}
          </option>
        </select>
        <span class="font-mono text-sm tabular-nums"
          >{{ index }} / {{ length }}</span
        >
      </div>
    </template>
  </main>
</template>
