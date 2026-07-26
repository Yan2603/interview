<script setup lang="ts">
import type { ChatSession } from '../types';

defineProps<{
  sessions: ChatSession[];
  activeId: string | null;
  loading?: boolean;
}>();

const emit = defineEmits<{
  select: [id: string];
  create: [];
  delete: [id: string];
}>();
</script>

<template>
  <div class="session-list">
    <div class="session-list-header">
      <span class="session-list-title">会话</span>
      <a-button type="primary" size="small" @click="emit('create')">新建</a-button>
    </div>
    <a-spin :spinning="!!loading">
      <a-empty v-if="!loading && sessions.length === 0" description="暂无会话" :image="false" />
      <ul v-else class="session-items">
        <li
          v-for="session in sessions"
          :key="session.id"
          class="session-item"
          :class="{ active: session.id === activeId }"
          @click="emit('select', session.id)"
        >
          <span class="session-title" :title="session.title">{{ session.title || '未命名会话' }}</span>
          <a-popconfirm
            title="确定删除该会话？"
            ok-text="删除"
            cancel-text="取消"
            @confirm="emit('delete', session.id)"
          >
            <span class="session-delete" title="删除" @click.stop>×</span>
          </a-popconfirm>
        </li>
      </ul>
    </a-spin>
  </div>
</template>

<style scoped>
.session-list {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-width: 0;
  background: #fafafa;
  border-right: 1px solid #f0f0f0;
}

.session-list-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 14px;
  border-bottom: 1px solid #f0f0f0;
  flex-shrink: 0;
}

.session-list-title {
  font-weight: 600;
  color: #262626;
}

.session-items {
  list-style: none;
  margin: 0;
  padding: 8px;
  flex: 1 1 0;
  min-height: 0;
  overflow-x: hidden;
  overflow-y: auto;
}

.session-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  border-radius: 8px;
  cursor: pointer;
  margin-bottom: 4px;
  transition: background 0.15s;
}

.session-item:hover {
  background: #f0f0f0;
}

.session-item.active {
  background: #e6f4ff;
}

.session-title {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 13px;
  color: #262626;
}

.session-delete {
  display: none;
  width: 20px;
  height: 20px;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  color: #999;
  font-size: 16px;
  line-height: 1;
  flex-shrink: 0;
}

.session-item:hover .session-delete {
  display: inline-flex;
}

.session-delete:hover {
  color: #ff4d4f;
  background: #fff1f0;
}
</style>
