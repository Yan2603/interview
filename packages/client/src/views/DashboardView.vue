<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import dayjs from 'dayjs';
import { api, INTERVIEW_TYPE_LABELS } from '../api';
import type { DashboardSummary, InterviewType } from '../types';

const router = useRouter();
const loading = ref(true);
const summary = ref<DashboardSummary | null>(null);

function eventTypeLabel(type?: InterviewType) {
  return INTERVIEW_TYPE_LABELS[type ?? 'remote'];
}

function eventDescription(item: DashboardSummary['upcomingEvents'][number]) {
  const time = dayjs(item.start).format('YYYY-MM-DD HH:mm');
  const parts = [time, eventTypeLabel(item.interviewType)];
  if (item.location) parts.push(item.location);
  return parts.join(' · ');
}

onMounted(async () => {
  try {
    summary.value = await api.getDashboard();
  } finally {
    loading.value = false;
  }
});
</script>

<template>
  <a-spin :spinning="loading">
    <h2 style="margin-top: 0">概览</h2>

    <a-row :gutter="16" v-if="summary">
      <a-col :span="8">
        <a-card title="题库统计">
          <a-statistic title="总题数" :value="summary.totalQuestions" />
          <div style="margin-top: 16px">
            <a-tag>未看 {{ summary.mastery.new ?? 0 }}</a-tag>
            <a-tag color="processing">复习中 {{ summary.mastery.reviewing ?? 0 }}</a-tag>
            <a-tag color="success">已掌握 {{ summary.mastery.mastered ?? 0 }}</a-tag>
          </div>
        </a-card>
      </a-col>

      <a-col :span="16">
        <a-card title="近 7 天面试">
          <a-empty v-if="!summary.upcomingEvents.length" description="暂无即将到来的面试" />
          <a-list v-else :data-source="summary.upcomingEvents" item-layout="horizontal">
            <template #renderItem="{ item }">
              <a-list-item
                class="event-item"
                @click="router.push(`/calendar/${item._id}`)"
              >
                <a-list-item-meta
                  :title="`${item.company} · ${item.round}`"
                  :description="eventDescription(item)"
                />
              </a-list-item>
            </template>
          </a-list>
        </a-card>
      </a-col>
    </a-row>

    <a-space style="margin-top: 24px">
      <a-button type="primary" @click="router.push('/questions')">进入题库</a-button>
      <a-button @click="router.push('/calendar')">查看日历</a-button>
    </a-space>
  </a-spin>
</template>

<style scoped>
.event-item {
  cursor: pointer;
}
.event-item:hover {
  background: #fafafa;
}
</style>
