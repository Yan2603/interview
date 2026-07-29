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
    {
      path: '/laser',
      component: () => import('../laser/LaserEditorView.vue'),
      meta: { title: '激光画板' },
    },
    {
      path: '/chat',
      component: () => import('../chat/ChatView.vue'),
      meta: { title: 'RAG 聊天' },
    },
    {
      path: '/knowledge',
      component: () => import('../knowledge/KnowledgeLayout.vue'),
      meta: { title: '知识库管理' },
      redirect: '/knowledge/documents',
      children: [
        {
          path: 'documents',
          component: () => import('../knowledge/KnowledgeDocumentsView.vue'),
          meta: { title: '文档知识库' },
        },
        {
          path: 'questions',
          component: () => import('../knowledge/KnowledgeQuestionsIndexView.vue'),
          meta: { title: '题目索引对照' },
        },
        {
          path: 'milvus',
          component: () => import('../knowledge/MilvusBrowserView.vue'),
          meta: { title: '向量库浏览器' },
        },
      ],
    },
  ],
});

router.afterEach((to) => {
  const page = to.meta.title as string | undefined;
  document.title = page ? `${page} · ${APP_TITLE}` : APP_TITLE;
});

export default router;
