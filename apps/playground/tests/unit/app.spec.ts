import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';

import { loadTrace } from '@algoviz/core';

import App from '@/App.vue';
import { bubbleSort } from '@/samples/bubble-sort';

describe('bubbleSort sample', () => {
  it('records a valid trace that ends sorted', () => {
    const result = loadTrace(bubbleSort([5, 3, 8, 1, 4]));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const last = result.value.frame(result.value.length).state['arr'];
    expect(last?.state.data.map((e) => e.value)).toEqual([1, 3, 4, 5, 8]);
    expect(last?.state.marks.settled).toHaveLength(5);
  });
});

describe('App', () => {
  it('steps through the trace', async () => {
    const wrapper = mount(App);
    expect(wrapper.find('[data-testid="scene"] svg').exists()).toBe(true);
    expect(wrapper.get('[data-testid="narration"]').text()).toBe(
      'Initial state.',
    );
    await wrapper.findAll('button')[1]!.trigger('click');
    expect(wrapper.get('[data-testid="narration"]').text()).toBe(
      'Compare 5 and 3.',
    );
    expect(wrapper.findAll('[data-role="compare"]')).toHaveLength(2);
  });
});
