import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';

import { PROTOCOL_VERSION } from '@algoviz/spec';

import App from '@/App.vue';

describe('App', () => {
  it('shows the playground heading and protocol version', () => {
    const wrapper = mount(App);
    expect(wrapper.get('h1').text()).toBe('algoviz playground');
    expect(wrapper.text()).toContain(`Protocol version ${PROTOCOL_VERSION}`);
  });
});
