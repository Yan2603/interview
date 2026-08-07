<script setup lang="ts">
import { reactive, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { message } from 'ant-design-vue';
import { useAuthStore } from '../auth/authStore';
import { sanitizeRedirect } from '../auth/redirect';
import { useParticleField } from '../composables/useParticleField';

const route = useRoute();
const router = useRouter();
const auth = useAuthStore();

const loading = ref(false);
const form = reactive({
  username: '',
  password: '',
});

const { canvasRef } = useParticleField();

async function onSubmit() {
  if (!form.username.trim() || !form.password) {
    message.error('请输入用户名和密码');
    return;
  }

  loading.value = true;
  try {
    await auth.login(form.username.trim(), form.password);
    await router.replace(sanitizeRedirect(route.query.redirect));
  } catch (err: unknown) {
    const apiMessage =
      err &&
      typeof err === 'object' &&
      'response' in err &&
      (err as { response?: { data?: { message?: string | string[] } } }).response
        ?.data?.message;

    const text = Array.isArray(apiMessage)
      ? apiMessage[0]
      : typeof apiMessage === 'string'
        ? apiMessage
        : '用户名或密码错误';

    message.error(text);
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <div class="login-page">
    <div class="login-atmosphere" aria-hidden="true">
      <div class="login-glow login-glow--a" />
      <div class="login-glow login-glow--b" />
      <canvas ref="canvasRef" class="login-particles" />
    </div>

    <a-card class="login-card" :bordered="false">
      <div class="login-card__corners" aria-hidden="true" />
      <div class="login-card__header">
        <h1 class="login-card__title">登录</h1>
        <p class="login-card__brand">面试驾驶舱</p>
      </div>

      <a-form :model="form" layout="vertical" @finish="onSubmit">
        <a-form-item
          label="用户名"
          name="username"
          :rules="[{ required: true, message: '请输入用户名' }]"
        >
          <a-input
            v-model:value="form.username"
            autocomplete="username"
            placeholder="用户名"
            allow-clear
          />
        </a-form-item>
        <a-form-item
          label="密码"
          name="password"
          :rules="[{ required: true, message: '请输入密码' }]"
        >
          <a-input-password
            v-model:value="form.password"
            autocomplete="current-password"
            placeholder="密码"
          />
        </a-form-item>
        <a-form-item>
          <a-button type="primary" html-type="submit" block :loading="loading">
            登录
          </a-button>
        </a-form-item>
      </a-form>
    </a-card>
  </div>
</template>

<style scoped>
.login-page {
  --login-bg-0: #e8eef8;
  --login-bg-1: #d4e2f5;
  --login-accent: #2f6fed;
  --login-accent-soft: rgba(47, 111, 237, 0.22);
  --login-text: #1a2744;
  --login-muted: rgba(60, 85, 130, 0.62);
  --login-border: rgba(70, 120, 200, 0.28);

  position: relative;
  isolation: isolate;
  height: 100%;
  min-height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  overflow: hidden;
  background:
    radial-gradient(90% 70% at 80% 10%, rgba(120, 180, 255, 0.45), transparent 55%),
    radial-gradient(70% 60% at 10% 90%, rgba(160, 210, 255, 0.35), transparent 50%),
    linear-gradient(165deg, var(--login-bg-0), var(--login-bg-1));
  color: var(--login-text);
}

.login-atmosphere {
  position: absolute;
  inset: 0;
  z-index: 0;
  pointer-events: none;
  overflow: hidden;
}

.login-glow {
  position: absolute;
  border-radius: 50%;
  filter: blur(60px);
  opacity: 0.55;
}

.login-glow--a {
  width: 420px;
  height: 420px;
  left: -80px;
  top: -60px;
  background: radial-gradient(circle, rgba(120, 180, 255, 0.7), transparent 70%);
}

.login-glow--b {
  width: 380px;
  height: 380px;
  right: -60px;
  bottom: -40px;
  background: radial-gradient(circle, rgba(90, 160, 240, 0.45), transparent 70%);
}

.login-particles {
  position: absolute;
  inset: 0;
  display: block;
  width: 100%;
  height: 100%;
}

.login-card {
  position: relative;
  z-index: 1;
  width: 100%;
  max-width: 360px;
  background: rgba(255, 255, 255, 0.72) !important;
  backdrop-filter: blur(18px);
  -webkit-backdrop-filter: blur(18px);
  border: 1px solid var(--login-border) !important;
  border-radius: 14px;
  box-shadow:
    0 0 0 1px rgba(255, 255, 255, 0.55) inset,
    0 18px 40px rgba(40, 80, 140, 0.12);
}

.login-card :deep(.ant-card-body) {
  padding: 28px 24px 22px;
}

.login-card__corners {
  pointer-events: none;
  position: absolute;
  inset: 10px;
}

.login-card__corners::before,
.login-card__corners::after {
  content: '';
  position: absolute;
  width: 14px;
  height: 14px;
  border-color: rgba(70, 120, 200, 0.45);
  border-style: solid;
}

.login-card__corners::before {
  top: 0;
  left: 0;
  border-width: 1px 0 0 1px;
}

.login-card__corners::after {
  top: 0;
  right: 0;
  border-width: 1px 1px 0 0;
}

.login-card__header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 20px;
  padding-bottom: 14px;
  border-bottom: 1px solid rgba(70, 120, 200, 0.14);
}

.login-card__title {
  margin: 0;
  font-size: 20px;
  font-weight: 600;
  letter-spacing: 0.04em;
  color: var(--login-text);
}

.login-card__brand {
  margin: 0;
  font-size: 12px;
  letter-spacing: 0.08em;
  color: var(--login-muted);
  white-space: nowrap;
}

.login-card :deep(.ant-form-item-label > label) {
  color: rgba(40, 60, 100, 0.88);
}

.login-card :deep(.ant-input-affix-wrapper) {
  min-height: 44px;
  padding: 0 14px;
  border-radius: 10px;
  border: 1px solid rgba(100, 140, 200, 0.4);
  background: transparent !important;
  box-shadow: none;
  color: var(--login-text);
}

.login-card :deep(.ant-input-affix-wrapper:hover),
.login-card :deep(.ant-input-affix-wrapper-focused),
.login-card :deep(.ant-input-affix-wrapper:focus-within) {
  background: transparent !important;
  border-color: var(--login-accent) !important;
  box-shadow: 0 0 0 2px var(--login-accent-soft);
}

/* 内层 input 去底去边，避免「套娃」割裂感 */
.login-card :deep(.ant-input-affix-wrapper > input.ant-input),
.login-card :deep(.ant-input-affix-wrapper .ant-input) {
  height: 42px;
  padding: 0;
  border: none !important;
  border-radius: 0;
  background: transparent !important;
  box-shadow: none !important;
  font-size: 15px;
  color: var(--login-text);
}

.login-card :deep(.ant-input-affix-wrapper > input.ant-input:hover),
.login-card :deep(.ant-input-affix-wrapper > input.ant-input:focus),
.login-card :deep(.ant-input-affix-wrapper .ant-input:hover),
.login-card :deep(.ant-input-affix-wrapper .ant-input:focus) {
  border: none !important;
  background: transparent !important;
  box-shadow: none !important;
}

.login-card :deep(input.ant-input:-webkit-autofill),
.login-card :deep(input.ant-input:-webkit-autofill:hover),
.login-card :deep(input.ant-input:-webkit-autofill:focus),
.login-card :deep(.ant-input-affix-wrapper > input.ant-input:-webkit-autofill) {
  -webkit-text-fill-color: var(--login-text);
  caret-color: var(--login-text);
  transition: background-color 99999s ease-out;
  box-shadow: 0 0 0 1000px transparent inset !important;
  background-color: transparent !important;
}

.login-card :deep(.ant-input::placeholder) {
  color: rgba(90, 115, 155, 0.5);
}

.login-card :deep(.ant-input-password-icon),
.login-card :deep(.ant-input-clear-icon) {
  color: rgba(90, 115, 155, 0.65);
}

.login-card :deep(.ant-btn-primary) {
  background: var(--login-accent);
  border-color: var(--login-accent);
  height: 40px;
  font-weight: 500;
}

.login-card :deep(.ant-btn-primary:hover) {
  background: #3d7cf5;
  border-color: #3d7cf5;
}

.login-card :deep(.ant-form-item-explain-error) {
  color: #d4380d;
}

@media (max-width: 480px) {
  .login-glow {
    opacity: 0.35;
  }

  .login-card__header {
    flex-wrap: wrap;
  }
}
</style>
