<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import dayjs from 'dayjs';
import { message } from 'ant-design-vue';
import { api, INTERVIEW_TYPE_LABELS } from '../api';
import type { EventStatus, InterviewEvent, InterviewType } from '../types';

const route = useRoute();
const router = useRouter();
const loading = ref(true);
const saving = ref(false);
const event = ref<InterviewEvent | null>(null);

const form = ref({
  company: '',
  round: '',
  start: dayjs(),
  interviewType: 'remote' as InterviewType,
  location: '',
  link: '',
  notes: '',
  status: 'scheduled' as EventStatus,
});

const isRemote = computed(() => form.value.interviewType === 'remote');

const locationPlaceholder = computed(() =>
  isRemote.value ? '如：腾讯会议 / 飞书，或线上平台说明' : '如：北京市朝阳区 XX 大厦 3 楼',
);

async function load() {
  loading.value = true;
  try {
    event.value = await api.getEvent(route.params.id as string);
    form.value = {
      company: event.value.company,
      round: event.value.round,
      start: dayjs(event.value.start),
      interviewType: event.value.interviewType ?? 'remote',
      location: event.value.location ?? '',
      link: event.value.link,
      notes: event.value.notes,
      status: event.value.status,
    };
  } finally {
    loading.value = false;
  }
}

onMounted(load);

async function save() {
  if (!event.value) return;
  saving.value = true;
  try {
    event.value = await api.updateEvent(event.value._id, {
      company: form.value.company,
      round: form.value.round,
      start: form.value.start.toISOString(),
      interviewType: form.value.interviewType,
      location: form.value.location,
      link: form.value.link,
      notes: form.value.notes,
      status: form.value.status,
    });
    message.success('已保存');
  } finally {
    saving.value = false;
  }
}

async function removeEvent() {
  if (!event.value) return;
  await api.deleteEvent(event.value._id);
  message.success('已删除');
  router.push('/calendar');
}
</script>

<template>
  <a-spin :spinning="loading">
    <template v-if="event">
      <div class="toolbar">
        <a-button @click="router.push('/calendar')">返回日历</a-button>
        <a-popconfirm title="确定删除？" @confirm="removeEvent">
          <a-button danger>删除</a-button>
        </a-popconfirm>
      </div>

      <h2>
        {{ form.company }} · {{ form.round }}
        <a-tag :color="isRemote ? 'blue' : 'green'" style="margin-left: 8px; vertical-align: middle">
          {{ INTERVIEW_TYPE_LABELS[form.interviewType] }}
        </a-tag>
      </h2>
      <p style="color: #666">{{ dayjs(event.start).format('YYYY-MM-DD HH:mm') }}</p>
      <p v-if="form.location" style="color: #666">地点：{{ form.location }}</p>

      <a-card>
        <a-form layout="vertical">
          <a-row :gutter="16">
            <a-col :span="12">
              <a-form-item label="公司">
                <a-input v-model:value="form.company" />
              </a-form-item>
            </a-col>
            <a-col :span="12">
              <a-form-item label="轮次">
                <a-input v-model:value="form.round" />
              </a-form-item>
            </a-col>
          </a-row>
          <a-form-item label="时间">
            <a-date-picker
              v-model:value="form.start"
              show-time
              format="YYYY-MM-DD HH:mm"
              style="width: 100%"
            />
          </a-form-item>
          <a-form-item label="面试方式">
            <a-radio-group v-model:value="form.interviewType">
              <a-radio value="remote">{{ INTERVIEW_TYPE_LABELS.remote }}</a-radio>
              <a-radio value="onsite">{{ INTERVIEW_TYPE_LABELS.onsite }}</a-radio>
            </a-radio-group>
          </a-form-item>
          <a-form-item label="状态">
            <a-select v-model:value="form.status">
              <a-select-option value="scheduled">待面试</a-select-option>
              <a-select-option value="completed">已完成</a-select-option>
              <a-select-option value="cancelled">已取消</a-select-option>
            </a-select>
          </a-form-item>
          <a-form-item label="面试地点">
            <a-input v-model:value="form.location" :placeholder="locationPlaceholder" />
          </a-form-item>
          <a-form-item v-if="isRemote" label="会议链接">
            <a-input v-model:value="form.link" placeholder="腾讯会议 / 飞书链接" />
          </a-form-item>
          <a-form-item label="面后复盘">
            <a-textarea
              v-model:value="form.notes"
              :rows="8"
              placeholder="记录面试问题、感受、待补充的知识点..."
            />
          </a-form-item>
          <a-button type="primary" :loading="saving" @click="save">保存</a-button>
        </a-form>
      </a-card>
    </template>
  </a-spin>
</template>

<style scoped>
.toolbar {
  display: flex;
  justify-content: space-between;
  margin-bottom: 16px;
}
</style>
