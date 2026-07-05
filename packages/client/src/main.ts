import { createApp } from 'vue';
import { createPinia } from 'pinia';
import Antd from 'ant-design-vue';
import 'ant-design-vue/dist/reset.css';
import dayjs from 'dayjs';
import 'dayjs/locale/zh-cn';
import App from './App.vue';
import router from './router';

dayjs.locale('zh-cn');

// After redeploy, cached entry JS may reference removed chunks — refresh once.
window.addEventListener('vite:preloadError', (event) => {
  event.preventDefault();
  window.location.reload();
});

createApp(App).use(createPinia()).use(router).use(Antd).mount('#app');
