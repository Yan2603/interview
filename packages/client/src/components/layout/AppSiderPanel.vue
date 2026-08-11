<script setup lang="ts">
import { DownOutlined, LogoutOutlined, UserOutlined } from '@ant-design/icons-vue';
import type { Category } from '../../types';

defineProps<{
  categories: Category[];
  mainSelectedKeys: string[];
  categorySelectedKeys: string[];
  openKeys: string[];
  username?: string;
}>();

const emit = defineEmits<{
  'update:openKeys': [keys: string[]];
  'go-category': [slug: string];
  'add-category': [];
  'edit-category': [cat: Category, event?: Event];
  'remove-category': [cat: Category];
  logout: [];
}>();

function popupContainer() {
  return document.body;
}

function onUserMenuClick(info: { key: string | number }) {
  if (info.key === 'logout') {
    emit('logout');
  }
}

function onOpenKeysUpdate(keys: string[]) {
  emit('update:openKeys', keys);
}
</script>

<template>
  <div class="sider-panel">
    <div class="logo">
      <img src="/favicon.svg" alt="" class="logo-icon" />
      <span class="logo-text">面试驾驶舱</span>
    </div>
    <div class="sider-scroll">
      <a-menu
        mode="inline"
        :selected-keys="[...mainSelectedKeys, ...categorySelectedKeys]"
        :open-keys="openKeys"
        style="border: none"
        @update:open-keys="onOpenKeysUpdate"
      >
        <a-menu-item key="dashboard">
          <router-link to="/">概览</router-link>
        </a-menu-item>
        <a-menu-item key="questions">
          <router-link to="/questions">题库</router-link>
        </a-menu-item>
        <a-menu-item key="calendar">
          <router-link to="/calendar">日历</router-link>
        </a-menu-item>
        <a-menu-item key="laser">
          <router-link to="/laser">激光画板</router-link>
        </a-menu-item>
        <a-menu-item key="chat">
          <router-link to="/chat">RAG 聊天</router-link>
        </a-menu-item>
        <a-sub-menu key="knowledge" title="知识库管理">
          <a-menu-item key="knowledge-documents">
            <router-link to="/knowledge/documents">文档知识库</router-link>
          </a-menu-item>
          <a-menu-item key="knowledge-questions">
            <router-link to="/knowledge/questions">题目索引对照</router-link>
          </a-menu-item>
          <a-menu-item key="knowledge-milvus">
            <router-link to="/knowledge/milvus">向量库浏览器</router-link>
          </a-menu-item>
        </a-sub-menu>

        <a-menu-divider />

        <a-menu-item-group>
          <template #title>
            <span class="category-group-title">
              分类
              <a-button
                type="link"
                size="small"
                class="add-category-btn"
                @click.stop="emit('add-category')"
              >
                + 添加
              </a-button>
            </span>
          </template>
          <a-menu-item
            v-for="cat in categories"
            :key="`cat-${cat.slug}`"
            @click="emit('go-category', cat.slug)"
          >
            <span class="category-item">
              <span class="category-name">{{ cat.name }}</span>
              <span class="category-actions" @click.stop>
                <span
                  class="category-edit"
                  title="编辑分类"
                  @click="emit('edit-category', cat, $event)"
                >
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path
                      d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zm2.92 2.83H5v-.92l9.06-9.06.92.92L5.92 20.08zM20.71 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"
                    />
                  </svg>
                </span>
                <a-popconfirm
                  title="确定删除该分类？"
                  ok-text="删除"
                  cancel-text="取消"
                  @confirm="emit('remove-category', cat)"
                >
                  <span class="category-delete">×</span>
                </a-popconfirm>
              </span>
            </span>
          </a-menu-item>
        </a-menu-item-group>
      </a-menu>
    </div>
    <div class="sider-footer">
      <a-dropdown
        v-if="username"
        :trigger="['click']"
        placement="topLeft"
        :get-popup-container="popupContainer"
      >
        <button type="button" class="sider-user" aria-label="用户菜单">
          <a-avatar :size="32" class="sider-avatar">
            <template #icon><UserOutlined /></template>
          </a-avatar>
          <span class="sider-username">{{ username }}</span>
          <DownOutlined class="sider-user-caret" />
        </button>
        <template #overlay>
          <a-menu @click="onUserMenuClick">
            <a-menu-item key="logout">
              <LogoutOutlined />
              退出登录
            </a-menu-item>
          </a-menu>
        </template>
      </a-dropdown>
    </div>
  </div>
</template>

<style scoped>
.sider-panel {
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.logo {
  height: 64px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 0 20px;
  border-bottom: 1px solid #f0f0f0;
}

.logo-icon {
  width: 28px;
  height: 28px;
  flex-shrink: 0;
}

.logo-text {
  font-size: 16px;
  font-weight: 600;
  line-height: 1.2;
  color: #262626;
}

.sider-scroll {
  flex: 1 1 0;
  min-height: 0;
  overflow-x: hidden;
  overflow-y: auto;
}

.sider-footer {
  flex-shrink: 0;
  margin-top: auto;
  padding: 12px 16px;
  border-top: 1px solid #f0f0f0;
}

.sider-user {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  margin: 0;
  padding: 6px 8px;
  border: none;
  border-radius: 8px;
  background: transparent;
  cursor: pointer;
  min-width: 0;
  text-align: left;
}

.sider-user:hover {
  background: #f5f5f5;
}

.sider-avatar {
  flex-shrink: 0;
  background: #1677ff;
}

.sider-username {
  flex: 1;
  min-width: 0;
  font-size: 13px;
  color: #595959;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.sider-user-caret {
  flex-shrink: 0;
  font-size: 10px;
  color: #8c8c8c;
}

a {
  color: inherit;
  text-decoration: none;
}

.category-group-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
}

.add-category-btn {
  padding: 0;
  height: auto;
  font-size: 12px;
}

.category-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.category-name {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.category-actions {
  display: none;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
}

.category-edit,
.category-delete {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  border-radius: 4px;
  color: #999;
  cursor: pointer;
  flex-shrink: 0;
}

.category-edit svg {
  width: 13px;
  height: 13px;
  fill: currentColor;
}

.category-edit:hover {
  color: #1677ff;
  background: #e6f4ff;
}

.category-delete {
  font-size: 16px;
  line-height: 1;
}

.category-delete:hover {
  color: #ff4d4f;
  background: #fff1f0;
}

:deep(.ant-menu-item:hover) .category-actions {
  display: inline-flex;
}
</style>
