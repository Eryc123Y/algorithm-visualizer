import { createApp } from 'vue';

import { AlgoPlayer } from '@algomotion/elements';
// The themes' web fonts, bundled with the page by Vite (ADR 0030), so the
// players need not link them themselves.
import '@algomotion/elements/fonts.css';

import App from './App.vue';
import './assets/css/tailwind.css';

AlgoPlayer.fontsUrl = null;

createApp(App).mount('#app');
