import { createRouter, createWebHistory } from 'vue-router';

const APP_TITLE = '面试驾驶舱';

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      component: () => import('../views/DashboardView.vue'),
      meta: { title: '概览' },
    },
    {
      path: '/questions',
      component: () => import('../views/QuestionsView.vue'),
      meta: { title: '题库' },
    },
    {
      path: '/questions/:id',
      component: () => import('../views/QuestionDetailView.vue'),
      meta: { title: '题目详情' },
    },
    {
      path: '/calendar',
      component: () => import('../views/CalendarView.vue'),
      meta: { title: '日历' },
    },
    {
      path: '/calendar/:id',
      component: () => import('../views/EventDetailView.vue'),
      meta: { title: '面试详情' },
    },
  ],
});

router.afterEach((to) => {
  const page = to.meta.title as string | undefined;
  document.title = page ? `${page} · ${APP_TITLE}` : APP_TITLE;
});

export default router;
