<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { message } from 'ant-design-vue';
import { api } from '../api';
import { getErrorMessage } from '../utils/error';
import SessionList from './components/SessionList.vue';
import MessageList from './components/MessageList.vue';
import Composer from './components/Composer.vue';
import { streamChatMessage } from './streamMessage';
import type { ChatMessage, ChatSession, ChatSourceRef } from './types';

const sessions = ref<ChatSession[]>([]);
const activeId = ref<string | null>(null);
const messages = ref<ChatMessage[]>([]);
const sessionsLoading = ref(false);
const messagesLoading = ref(false);
const sending = ref(false);

const composerDisabled = computed(() => !activeId.value || messagesLoading.value);

function isSoftNotice(text: string) {
  return text.includes('未命中知识库');
}

function mapStreamError(raw: string): string {
  if (raw.includes('503') || raw.includes('AI_API_KEY')) {
    return 'AI 服务暂不可用，请稍后重试';
  }
  if (raw.startsWith('HTTP ')) return `请求失败（${raw.replace('HTTP ', '')}）`;
  return raw || '发送失败';
}

async function loadSessions(preferId?: string | null) {
  sessionsLoading.value = true;
  try {
    sessions.value = await api.listChatSessions();
    const nextId =
      preferId && sessions.value.some((s) => s.id === preferId)
        ? preferId
        : activeId.value && sessions.value.some((s) => s.id === activeId.value)
          ? activeId.value
          : (sessions.value[0]?.id ?? null);
    if (nextId) {
      await selectSession(nextId);
    } else {
      activeId.value = null;
      messages.value = [];
    }
  } catch (err) {
    message.error(getErrorMessage(err) || '加载会话失败');
  } finally {
    sessionsLoading.value = false;
  }
}

async function selectSession(id: string) {
  activeId.value = id;
  messagesLoading.value = true;
  try {
    const session = await api.getChatSession(id);
    messages.value = session.messages ?? [];
  } catch (err) {
    message.error(getErrorMessage(err) || '加载消息失败');
    messages.value = [];
  } finally {
    messagesLoading.value = false;
  }
}

async function createSession() {
  try {
    const session = await api.createChatSession('新会话');
    sessions.value = [session, ...sessions.value];
    activeId.value = session.id;
    messages.value = session.messages ?? [];
  } catch (err) {
    message.error(getErrorMessage(err) || '新建会话失败');
  }
}

async function deleteSession(id: string) {
  try {
    await api.deleteChatSession(id);
    sessions.value = sessions.value.filter((s) => s.id !== id);
    if (activeId.value === id) {
      const next = sessions.value[0];
      if (next) {
        await selectSession(next.id);
      } else {
        activeId.value = null;
        messages.value = [];
      }
    }
    message.success('会话已删除');
  } catch (err) {
    message.error(getErrorMessage(err) || '删除会话失败');
  }
}

function tempId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function patchAssistant(assistantId: string, patch: Partial<ChatMessage>) {
  const idx = messages.value.findIndex((m) => m.id === assistantId);
  if (idx < 0) return;
  const current = messages.value[idx];
  messages.value[idx] = { ...current, ...patch };
}

async function sendMessage(content: string) {
  const sessionId = activeId.value;
  if (!sessionId || sending.value) return;

  const now = new Date().toISOString();
  const assistantId = tempId('assistant');
  const userMsg: ChatMessage = {
    id: tempId('user'),
    role: 'user',
    content,
    createdAt: now,
  };
  const assistantMsg: ChatMessage = {
    id: assistantId,
    role: 'assistant',
    content: '',
    sources: null,
    createdAt: now,
  };
  messages.value = [...messages.value, userMsg, assistantMsg];
  sending.value = true;

  try {
    await streamChatMessage(sessionId, content, {
      onToken: (token) => {
        const current = messages.value.find((m) => m.id === assistantId);
        if (!current) return;
        patchAssistant(assistantId, { content: current.content + token });
      },
      onSources: (sources: ChatSourceRef[]) => {
        patchAssistant(assistantId, { sources });
      },
      onDone: () => {
        /* reload in finally */
      },
      onError: (errMsg) => {
        if (isSoftNotice(errMsg)) return;
        message.error(mapStreamError(errMsg));
      },
    });
  } finally {
    sending.value = false;
    // Always sync from server after stream ends (even if `done` event was missed).
    await reloadSessionMessages(sessionId);
  }
}

async function reloadSessionMessages(sessionId: string) {
  try {
    const session = await api.getChatSession(sessionId);
    const idx = sessions.value.findIndex((s) => s.id === sessionId);
    if (idx >= 0) {
      sessions.value[idx] = {
        ...sessions.value[idx],
        title: session.title,
        updatedAt: session.updatedAt,
      };
    }
    // Avoid clobbering another session's messages if the user switched mid-stream.
    if (activeId.value === sessionId) {
      messages.value = session.messages ?? [];
    }
  } catch {
    /* ignore refresh errors; optimistic messages remain */
  }
}

onMounted(() => {
  void loadSessions();
});
</script>

<template>
  <div class="chat-view">
    <aside class="pane-left">
      <SessionList
        :sessions="sessions"
        :active-id="activeId"
        :loading="sessionsLoading"
        @select="selectSession"
        @create="createSession"
        @delete="deleteSession"
      />
    </aside>

    <section class="pane-center">
      <div class="messages-wrap">
        <div v-if="messagesLoading" class="messages-loading">
          <a-spin />
        </div>
        <MessageList :messages="messages" :streaming="sending" />
      </div>
      <Composer :disabled="composerDisabled" :loading="sending" @send="sendMessage" />
    </section>
  </div>
</template>

<style scoped>
.chat-view {
  display: flex;
  height: 100%;
  min-height: 0;
  width: 100%;
  background: #fff;
  overflow: hidden;
}

.pane-left {
  width: 240px;
  flex-shrink: 0;
  min-height: 0;
  overflow: hidden;
}

.pane-center {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
}

.messages-wrap {
  position: relative;
  flex: 1 1 0;
  min-height: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.messages-loading {
  position: absolute;
  inset: 0;
  z-index: 2;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.55);
}
</style>
