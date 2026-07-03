<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import dayjs, { Dayjs } from 'dayjs';
import { api, INTERVIEW_TYPE_LABELS } from '../api';
import type { InterviewEvent, InterviewType } from '../types';

const router = useRouter();
const loading = ref(false);
const events = ref<InterviewEvent[]>([]);
const selectedDate = ref(dayjs());
const modalOpen = ref(false);

const form = ref({
  company: '',
  round: '一面',
  start: dayjs(),
  interviewType: 'remote' as InterviewType,
  location: '',
  link: '',
  notes: '',
});

const isRemote = computed(() => form.value.interviewType === 'remote');

const locationPlaceholder = computed(() =>
  isRemote.value ? '如：腾讯会议 / 飞书，或线上平台说明' : '如：北京市朝阳区 XX 大厦 3 楼',
);

const monthRange = computed(() => ({
  from: selectedDate.value.startOf('month').toISOString(),
  to: selectedDate.value.endOf('month').toISOString(),
}));

const eventsByDate = computed(() => {
  const map: Record<string, InterviewEvent[]> = {};
  for (const evt of events.value) {
    const key = dayjs(evt.start).format('YYYY-MM-DD');
    (map[key] ??= []).push(evt);
  }
  return map;
});

function eventTypeLabel(type?: InterviewType) {
  return INTERVIEW_TYPE_LABELS[type ?? 'remote'];
}

async function loadEvents() {
  loading.value = true;
  try {
    events.value = await api.getEvents(monthRange.value);
  } finally {
    loading.value = false;
  }
}

onMounted(loadEvents);

function onPanelChange(date: Dayjs | string) {
  selectedDate.value = dayjs(date);
  loadEvents();
}

function openCreate(date?: Dayjs) {
  form.value = {
    company: '',
    round: '一面',
    start: date ?? dayjs().hour(14).minute(0),
    interviewType: 'remote',
    location: '',
    link: '',
    notes: '',
  };
  modalOpen.value = true;
}

async function createEvent() {
  await api.createEvent({
    company: form.value.company,
    round: form.value.round,
    start: form.value.start.toISOString(),
    interviewType: form.value.interviewType,
    location: form.value.location,
    link: form.value.link,
    notes: form.value.notes,
  });
  modalOpen.value = false;
  await loadEvents();
}

function goDetail(id: string) {
  router.push(`/calendar/${id}`);
}
</script>

<template>
  <div>
    <div class="toolbar">
      <h2 style="margin: 0">面试日历</h2>
      <a-button type="primary" @click="openCreate()">新建面试</a-button>
    </div>

    <a-spin :spinning="loading">
      <a-calendar v-model:value="selectedDate" @panelChange="onPanelChange">
        <template #dateCellRender="{ current }">
          <ul class="events">
            <li v-for="evt in eventsByDate[current.format('YYYY-MM-DD')] ?? []" :key="evt._id">
              <a-badge status="processing" />
              <a @click.stop="goDetail(evt._id)">
                [{{ eventTypeLabel(evt.interviewType) }}] {{ evt.company }} · {{ evt.round }}
              </a>
            </li>
          </ul>
        </template>
      </a-calendar>
    </a-spin>

    <a-modal v-model:open="modalOpen" title="新建面试" @ok="createEvent">
      <a-form layout="vertical">
        <a-form-item label="公司" required>
          <a-input v-model:value="form.company" />
        </a-form-item>
        <a-form-item label="轮次">
          <a-input v-model:value="form.round" />
        </a-form-item>
        <a-form-item label="时间" required>
          <a-date-picker
            v-model:value="form.start"
            show-time
            format="YYYY-MM-DD HH:mm"
            style="width: 100%"
          />
        </a-form-item>
        <a-form-item label="面试方式" required>
          <a-radio-group v-model:value="form.interviewType">
            <a-radio value="remote">{{ INTERVIEW_TYPE_LABELS.remote }}</a-radio>
            <a-radio value="onsite">{{ INTERVIEW_TYPE_LABELS.onsite }}</a-radio>
          </a-radio-group>
        </a-form-item>
        <a-form-item label="面试地点">
          <a-input v-model:value="form.location" :placeholder="locationPlaceholder" />
        </a-form-item>
        <a-form-item v-if="isRemote" label="会议链接">
          <a-input v-model:value="form.link" placeholder="腾讯会议 / 飞书链接" />
        </a-form-item>
        <a-form-item label="备注">
          <a-textarea v-model:value="form.notes" :rows="3" />
        </a-form-item>
      </a-form>
    </a-modal>
  </div>
</template>

<style scoped>
.toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.events {
  list-style: none;
  margin: 0;
  padding: 0;
  font-size: 12px;
}

.events li {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.events a {
  color: #1677ff;
  cursor: pointer;
}
</style>
