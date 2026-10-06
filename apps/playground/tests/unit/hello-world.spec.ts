import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';

import HelloWorld from '@/components/HelloWorld.vue';

describe('HelloWorld', () => {
  it('renders props.msg when passed', () => {
    const msg = 'new message';
    const wrapper = mount(HelloWorld, { props: { msg } });
    expect(wrapper.text()).toContain(msg);
  });
});
