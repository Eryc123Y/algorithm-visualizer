import { createApp } from 'vue'; // Import createApp function
import App from './App.vue'; // Import App.vue
import router from './router'; // Import router
import './assets/tailwind.css'; // Import Tailwind CSS

// App entry point
createApp(App).use(router).mount('#app');
