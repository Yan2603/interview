<script setup lang="ts">
import { computed, nextTick, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import dayjs, { Dayjs } from 'dayjs';
import { api, INTERVIEW_RESULT_LABELS, INTERVIEW_TYPE_LABELS } from '../api';
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

function eventLabel(evt: InterviewEvent) {
  return `[${eventTypeLabel(evt.interviewType)}] ${evt.company} · ${evt.round}`;
}

function hasResult(evt: InterviewEvent) {
  return evt.status === 'completed' && !!evt.result && evt.result !== 'pending';
}

function dayEvents(date: Dayjs) {
  return eventsByDate.value[date.format('YYYY-MM-DD')] ?? [];
}

type CellTone = 'passed' | 'failed' | 'offer' | 'scheduled';

function cellTone(date: Dayjs): CellTone | null {
  const evts = dayEvents(date);
  if (!evts.length) return null;

  let tone: CellTone = 'scheduled';
  for (const evt of evts) {
    if (!hasResult(evt)) continue;
    if (evt.result === 'offer') return 'offer';
    if (evt.result === 'passed') tone = 'passed';
    else if (evt.result === 'failed' && tone !== 'passed') tone = 'failed';
  }
  return tone;
}

function cellClasses(date: Dayjs) {
  const classes: string[] = [];
  const evts = dayEvents(date);
  if (!date.isSame(selectedDate.value, 'month')) classes.push('other-month');
  if (date.isSame(dayjs(), 'day')) classes.push('today');
  // 无事件的日期（含今天）不做整格选中高亮，避免空格子边框过重
  if (date.isSame(selectedDate.value, 'day') && evts.length > 0) classes.push('selected');
  const tone = cellTone(date);
  if (tone) classes.push(`cell-${tone}`);
  return classes;
}

function cellResultLabel(date: Dayjs) {
  const labels: Record<CellTone, string> = {
    passed: '通过',
    failed: '未通过',
    offer: 'Offer',
    scheduled: '',
  };
  const tone = cellTone(date);
  return tone && tone !== 'scheduled' ? labels[tone] : '';
}

function eventDotClass(evt: InterviewEvent) {
  if (hasResult(evt)) return `dot-${evt.result}`;
  return evt.interviewType === 'onsite' ? 'onsite' : 'remote';
}

function eventTooltipLines(evt: InterviewEvent) {
  const lines = [
    `${evt.company} · ${evt.round}`,
    `${dayjs(evt.start).format('YYYY-MM-DD HH:mm')} · ${eventTypeLabel(evt.interviewType)}`,
  ];
  if (evt.location) lines.push(evt.location);
  if (hasResult(evt)) {
    lines.push(`结果：${INTERVIEW_RESULT_LABELS[evt.result]}`);
  }
  return lines;
}

/** 去掉 Ant Design Calendar 单元格自带的 date title，避免悬停弹出重复日期 */
async function stripCellTitles() {
  await nextTick();
  document
    .querySelectorAll('.ant-picker-calendar .ant-picker-cell')
    .forEach((el) => el.removeAttribute('title'));
}

async function loadEvents() {
  loading.value = true;
  try {
    events.value = await api.getEvents(monthRange.value);
  } finally {
    loading.value = false;
    await stripCellTitles();
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
        <template #dateFullCellRender="{ current }">
          <div class="calendar-cell" :class="cellClasses(current)">
            <div class="cell-header">
              <span v-if="cellResultLabel(current)" class="cell-result">{{ cellResultLabel(current) }}</span>
              <span class="cell-date" :class="{ 'is-today': current.isSame(dayjs(), 'day') }">
                {{ current.date() }}
              </span>
            </div>
            <ul v-if="dayEvents(current).length" class="events">
              <li v-for="evt in dayEvents(current)" :key="evt._id">
                <a-tooltip placement="topLeft" :mouse-enter-delay="0.3">
                  <template #title>
                    <div v-for="(line, i) in eventTooltipLines(evt)" :key="i">{{ line }}</div>
                  </template>
                  <a class="event-link" @click.stop="goDetail(evt._id)">
                    <span class="event-dot" :class="eventDotClass(evt)" />
                    <span class="event-text">{{ eventLabel(evt) }}</span>
                  </a>
                </a-tooltip>
              </li>
            </ul>
          </div>
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

.calendar-cell {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 88px;
  padding: 6px 8px;
  border: 1px solid #f0f0f0;
  border-radius: 4px;
  overflow: hidden;
  transition: border-color 0.2s, box-shadow 0.2s;
}

.calendar-cell.cell-passed {
  background: #f6ffed;
  border-color: #95de64;
}

.calendar-cell.cell-failed {
  background: #fff2f0;
  border-color: #ffa39e;
}

.calendar-cell.cell-offer {
  background: #fffbe6;
  border-color: #ffd666;
}

.calendar-cell.cell-scheduled {
  background: #e6f4ff;
  border-color: #91caff;
}

.calendar-cell.other-month {
  opacity: 0.45;
}

.calendar-cell.selected {
  box-shadow: inset 0 0 0 1px #1677ff;
}

.calendar-cell.cell-passed.selected {
  border-color: #52c41a;
  box-shadow: inset 0 0 0 1px #52c41a;
}

.calendar-cell.cell-failed.selected {
  border-color: #ff4d4f;
  box-shadow: inset 0 0 0 1px #ff4d4f;
}

.calendar-cell.cell-offer.selected {
  border-color: #faad14;
  box-shadow: inset 0 0 0 1px #faad14;
}

.calendar-cell.cell-scheduled.selected {
  border-color: #1677ff;
  box-shadow: inset 0 0 0 1px #1677ff;
}

.calendar-cell:hover {
  filter: brightness(0.98);
}

.cell-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 4px;
  margin-bottom: 4px;
}

.cell-date {
  margin-left: auto;
  font-size: 14px;
  line-height: 22px;
  min-width: 24px;
  text-align: center;
  color: rgba(0, 0, 0, 0.88);
}

.cell-date.is-today {
  background: #1677ff;
  color: #fff;
  border-radius: 4px;
  font-weight: 600;
}

.cell-result {
  font-size: 11px;
  font-weight: 600;
  line-height: 18px;
  padding: 0 6px;
  border-radius: 4px;
  white-space: nowrap;
}

.calendar-cell.cell-passed .cell-result {
  background: #52c41a;
  color: #fff;
}

.calendar-cell.cell-failed .cell-result {
  background: #ff4d4f;
  color: #fff;
}

.calendar-cell.cell-offer .cell-result {
  background: #faad14;
  color: #fff;
}

.events {
  list-style: none;
  margin: 0;
  padding: 0;
  width: 100%;
  font-size: 12px;
  overflow: hidden;
  flex: 1;
}

.events li {
  margin-top: 2px;
  overflow: hidden;
}

.events li :deep(.ant-tooltip) {
  display: block;
  width: 100%;
}

.event-link {
  display: flex;
  align-items: center;
  gap: 4px;
  width: 100%;
  min-width: 0;
  color: rgba(0, 0, 0, 0.75);
  cursor: pointer;
  line-height: 1.5;
  padding: 1px 0;
  overflow: hidden;
}

.event-link:hover {
  color: #1677ff;
}

.event-text {
  flex: 1;
  min-width: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.event-dot {
  flex-shrink: 0;
  width: 6px;
  height: 6px;
  border-radius: 50%;
}

.event-dot.remote {
  background: #1677ff;
}

.event-dot.onsite {
  background: #52c41a;
}

.event-dot.dot-passed {
  background: #389e0d;
}

.event-dot.dot-failed {
  background: #cf1322;
}

.event-dot.dot-offer {
  background: #d48806;
}

:deep(.ant-picker-calendar-full .ant-picker-panel .ant-picker-body) {
  padding: 8px 0 0;
}

:deep(.ant-picker-calendar-full .ant-picker-cell) {
  padding: 2px 0;
  vertical-align: top;
}

:deep(.ant-picker-calendar-full .ant-picker-cell-inner) {
  padding: 0 2px;
  height: 100%;
}

:deep(.ant-picker-calendar-full .ant-picker-cell-selected .ant-picker-cell-inner) {
  background: transparent;
}

:deep(.ant-picker-calendar-full .ant-picker-cell-selected .calendar-cell) {
  border-color: #f0f0f0;
  box-shadow: none;
}

:deep(.ant-picker-calendar-full .ant-picker-cell-selected .calendar-cell.cell-passed) {
  border-color: #95de64;
}

:deep(.ant-picker-calendar-full .ant-picker-cell-selected .calendar-cell.cell-failed) {
  border-color: #ffa39e;
}

:deep(.ant-picker-calendar-full .ant-picker-cell-selected .calendar-cell.cell-offer) {
  border-color: #ffd666;
}

:deep(.ant-picker-calendar-full .ant-picker-cell-selected .calendar-cell.cell-scheduled) {
  border-color: #91caff;
}
</style>
