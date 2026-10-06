<!--
  App.vue
  Playground: an <algo-player> driven by a JSON editor, so documents written
  by hand or by an LLM can be pasted in and checked immediately.
-->
<script setup lang="ts">
import { computed, ref, watch } from 'vue';

import '@algoviz/elements/define';
import type { PlayerMode, PlayerTheme } from '@algoviz/elements';

import { bubbleSort } from './samples/bubble-sort';
import { bubbleSortDocument } from './samples/bubble-sort-doc';
import { reverse } from './samples/reverse';

const initial = JSON.stringify(bubbleSortDocument([5, 3, 8, 1, 4]), null, 2);
const text = ref(initial);
const theme = ref<PlayerTheme>('auto');
const themes: PlayerTheme[] = ['auto', 'light', 'dark', 'print'];
const mode = ref<PlayerMode>('interactive');
const modes: PlayerMode[] = ['interactive', 'display'];

const displays = [
  { label: 'Bubble sort', doc: bubbleSort([6, 2, 8, 4, 1, 7, 3, 5]) },
  {
    label: 'Two-pointer reversal',
    doc: reverse(['a', 'l', 'g', 'o', 'v', 'i', 'z']),
  },
];

const parsed = computed<{ value: unknown; error: string | null }>(() => {
  try {
    return { value: JSON.parse(text.value), error: null };
  } catch (error) {
    return {
      value: undefined,
      error: error instanceof Error ? error.message : String(error),
    };
  }
});
// Keep showing the last valid document while the text is mid-edit.
const visualization = ref<unknown>(JSON.parse(initial));
watch(parsed, ({ value, error }) => {
  if (error === null) visualization.value = value;
});
</script>

<template>
  <main class="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-10">
    <header class="flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 class="text-3xl font-bold">algoviz playground</h1>
        <p class="text-slate-600">
          Edit the document on the right, or paste one written by an LLM.
        </p>
      </div>
      <div class="flex items-center gap-4 text-sm">
        <label class="flex items-center gap-2">
          Mode
          <select
            v-model="mode"
            class="rounded border px-2 py-1"
            data-testid="mode"
          >
            <option v-for="name in modes" :key="name" :value="name">
              {{ name }}
            </option>
          </select>
        </label>
        <label class="flex items-center gap-2">
          Theme
          <select
            v-model="theme"
            class="rounded border px-2 py-1"
            data-testid="theme"
          >
            <option v-for="name in themes" :key="name" :value="name">
              {{ name }}
            </option>
          </select>
        </label>
      </div>
    </header>

    <div class="grid gap-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
      <algo-player
        :visualization="visualization"
        :theme="theme"
        :mode="mode"
        data-testid="player"
      />
      <div class="flex min-w-0 flex-col gap-2">
        <textarea
          v-model="text"
          class="h-[520px] w-full rounded-lg border p-3 font-mono text-xs"
          spellcheck="false"
          aria-label="Visualization JSON"
          data-testid="editor"
        />
        <p
          v-if="parsed.error"
          class="text-sm text-red-700"
          data-testid="json-error"
        >
          Invalid JSON: {{ parsed.error }}
        </p>
      </div>
    </div>

    <section class="flex flex-col gap-3">
      <h2 class="text-xl font-semibold">Display mode</h2>
      <p class="text-slate-600">
        <code>mode="display"</code> shows only the structures, playing and
        looping on its own.
      </p>
      <div class="grid gap-6 sm:grid-cols-2">
        <figure
          v-for="item in displays"
          :key="item.label"
          class="flex flex-col gap-2"
        >
          <algo-player
            mode="display"
            speed="700"
            :theme="theme"
            :visualization="item.doc"
            data-testid="display"
          />
          <figcaption class="text-sm text-slate-500">
            {{ item.label }}
          </figcaption>
        </figure>
      </div>
    </section>
  </main>
</template>
