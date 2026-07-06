<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import dayjs from 'dayjs';
import { message } from 'ant-design-vue';
import { api, EVENT_STATUS_COLORS, EVENT_STATUS_LABELS, INTERVIEW_RESULT_COLORS, INTERVIEW_RESULT_LABELS, INTERVIEW_TYPE_LABELS } from '../api';
import RichTextEditor from '../components/RichTextEditor.vue';
import type { EventStatus, InterviewEvent, InterviewResult, InterviewType } from '../types';

const route = useRoute();
const router = useRouter();
const loading = ref(true);
const saving = ref(false);
const savingNotes = ref(false);
const editing = ref(false);
const editingNotes = ref(false);
const event = ref<InterviewEvent | null>(null);
const notes = ref('');
const notesDraft = ref('');

const form = ref({
  company: '',
  round: '',
  start: dayjs(),
  interviewType: 'remote' as InterviewType,
  location: '',
  link: '',
  notes: '',
  status: 'scheduled' as EventStatus,
  result: 'pending' as InterviewResult,
});

const isRemote = computed(() => form.value.interviewType === 'remote');

const NOTES_PLACEHOLDER = '记录面试问题、感受、待补充的知识点...';

const hasNotes = computed(() => notes.value.trim().length > 0);

watch(
  () => form.value.status,
  (status) => {
    if (status !== 'completed') {
      form.value.result = 'pending';
    }
  },
);

const locationPlaceholder = computed(() =>
  isRemote.value ? '如：腾讯会议 / 飞书，或线上平台说明' : '如：北京市朝阳区 XX 大厦 3 楼',
);

function syncForm() {
  if (!event.value) return;
  form.value = {
    company: event.value.company,
    round: event.value.round,
    start: dayjs(event.value.start),
    interviewType: event.value.interviewType ?? 'remote',
    location: event.value.location ?? '',
    link: event.value.link,
    notes: event.value.notes,
    status: event.value.status,
    result: event.value.result ?? 'pending',
  };
  notes.value = event.value.notes;
}

async function load() {
  loading.value = true;
  try {
    event.value = await api.getEvent(route.params.id as string);
    syncForm();
  } finally {
    loading.value = false;
  }
}

onMounted(load);

function startEdit() {
  editingNotes.value = false;
  syncForm();
  editing.value = true;
}

function cancelEdit() {
  editing.value = false;
  syncForm();
}

function startEditNotes() {
  notesDraft.value = notes.value;
  editingNotes.value = true;
}

function cancelEditNotes() {
  editingNotes.value = false;
  notesDraft.value = notes.value;
}

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
      result: form.value.result,
    });
    notes.value = event.value.notes;
    editing.value = false;
    message.success('已保存');
  } finally {
    saving.value = false;
  }
}

async function saveNotes() {
  if (!event.value) return;
  savingNotes.value = true;
  try {
    event.value = await api.updateEvent(event.value._id, { notes: notesDraft.value });
    notes.value = event.value.notes;
    form.value.notes = event.value.notes;
    editingNotes.value = false;
    message.success('复盘已保存');
  } finally {
    savingNotes.value = false;
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
        <a-space>
          <a-button v-if="!editing" @click="startEdit">编辑</a-button>
          <a-popconfirm title="确定删除？" @confirm="removeEvent">
            <a-button danger>删除</a-button>
          </a-popconfirm>
        </a-space>
      </div>

      <template v-if="editing">
        <h2>编辑面试</h2>
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
            <a-row :gutter="16">
              <a-col :span="12">
                <a-form-item label="面试状态">
                  <a-select v-model:value="form.status">
                    <a-select-option value="scheduled">{{ EVENT_STATUS_LABELS.scheduled }}</a-select-option>
                    <a-select-option value="completed">{{ EVENT_STATUS_LABELS.completed }}</a-select-option>
                    <a-select-option value="cancelled">{{ EVENT_STATUS_LABELS.cancelled }}</a-select-option>
                  </a-select>
                </a-form-item>
              </a-col>
              <a-col :span="12">
                <a-form-item label="面试结果">
                  <a-select v-model:value="form.result" :disabled="form.status !== 'completed'">
                    <a-select-option value="pending">{{ INTERVIEW_RESULT_LABELS.pending }}</a-select-option>
                    <a-select-option value="passed">{{ INTERVIEW_RESULT_LABELS.passed }}</a-select-option>
                    <a-select-option value="failed">{{ INTERVIEW_RESULT_LABELS.failed }}</a-select-option>
                    <a-select-option value="offer">{{ INTERVIEW_RESULT_LABELS.offer }}</a-select-option>
                  </a-select>
                </a-form-item>
              </a-col>
            </a-row>
            <a-form-item label="面试地点">
              <a-input v-model:value="form.location" :placeholder="locationPlaceholder" />
            </a-form-item>
            <a-form-item v-if="isRemote" label="会议链接">
              <a-input v-model:value="form.link" placeholder="腾讯会议 / 飞书链接" />
            </a-form-item>
            <a-form-item label="面后复盘">
              <RichTextEditor
                v-model="form.notes"
                :placeholder="NOTES_PLACEHOLDER"
              />
            </a-form-item>
            <a-space>
              <a-button type="primary" :loading="saving" @click="save">保存</a-button>
              <a-button @click="cancelEdit">取消</a-button>
            </a-space>
          </a-form>
        </a-card>
      </template>

      <template v-else>
        <h2>
          {{ event.company }} · {{ event.round }}
          <a-tag :color="event.interviewType === 'remote' ? 'blue' : 'green'" style="margin-left: 8px; vertical-align: middle">
            {{ INTERVIEW_TYPE_LABELS[event.interviewType ?? 'remote'] }}
          </a-tag>
          <a-tag :color="EVENT_STATUS_COLORS[event.status]" style="margin-left: 8px; vertical-align: middle">
            {{ EVENT_STATUS_LABELS[event.status] }}
          </a-tag>
          <a-tag
            v-if="event.status === 'completed'"
            :color="INTERVIEW_RESULT_COLORS[event.result ?? 'pending']"
            style="margin-left: 8px; vertical-align: middle"
          >
            {{ INTERVIEW_RESULT_LABELS[event.result ?? 'pending'] }}
          </a-tag>
        </h2>

        <a-descriptions :column="1" bordered size="small" style="margin-top: 16px; max-width: 640px">
          <a-descriptions-item label="时间">
            {{ dayjs(event.start).format('YYYY-MM-DD HH:mm') }}
          </a-descriptions-item>
          <a-descriptions-item v-if="event.location" label="地点">
            {{ event.location }}
          </a-descriptions-item>
          <a-descriptions-item v-if="event.link" label="会议链接">
            <a :href="event.link" target="_blank" rel="noopener noreferrer">{{ event.link }}</a>
          </a-descriptions-item>
          <a-descriptions-item v-if="event.status === 'completed'" label="面试结果">
            <a-tag :color="INTERVIEW_RESULT_COLORS[event.result ?? 'pending']">
              {{ INTERVIEW_RESULT_LABELS[event.result ?? 'pending'] }}
            </a-tag>
          </a-descriptions-item>
        </a-descriptions>

        <a-card title="面后复盘" style="margin-top: 16px">
          <template #extra>
            <a-button v-if="!editingNotes" size="small" @click="startEditNotes">
              {{ hasNotes ? '编辑复盘' : '写复盘' }}
            </a-button>
          </template>

          <template v-if="editingNotes">
            <RichTextEditor
              v-model="notesDraft"
              :placeholder="NOTES_PLACEHOLDER"
            />
            <a-space style="margin-top: 12px">
              <a-button type="primary" :loading="savingNotes" @click="saveNotes">保存</a-button>
              <a-button @click="cancelEditNotes">取消</a-button>
            </a-space>
          </template>
          <template v-else>
            <a-empty v-if="!hasNotes" description="暂无复盘，点击右上角开始记录" />
            <RichTextEditor v-else v-model="notes" readonly :min-height="120" />
          </template>
        </a-card>
      </template>
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
