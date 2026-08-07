<script setup lang="ts">
import { reactive, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { message } from 'ant-design-vue';
import { useAuthStore } from '../auth/authStore';
import { sanitizeRedirect } from '../auth/redirect';

const route = useRoute();
const router = useRouter();
const auth = useAuthStore();

const loading = ref(false);
const form = reactive({
  username: '',
  password: '',
});

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
      <div class="login-grid" />
      <div class="login-orb login-orb--a" />
      <div class="login-orb login-orb--b" />
      <div class="login-scan" />
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
  --login-bg-0: #070b14;
  --login-bg-1: #0d1526;
  --login-accent: #2f6fed;
  --login-accent-soft: rgba(47, 111, 237, 0.35);
  --login-text: rgba(235, 240, 255, 0.92);
  --login-muted: rgba(180, 195, 230, 0.55);
  --login-border: rgba(140, 170, 255, 0.28);

  position: relative;
  isolation: isolate;
  min-height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  overflow: hidden;
  background:
    radial-gradient(120% 80% at 50% -10%, #132038 0%, transparent 55%),
    linear-gradient(160deg, var(--login-bg-0), var(--login-bg-1));
  color: var(--login-text);
}

.login-atmosphere {
  position: absolute;
  inset: 0;
  z-index: 0;
  pointer-events: none;
  overflow: hidden;
}

.login-grid {
  position: absolute;
  inset: 0;
  background-image:
    linear-gradient(rgba(120, 160, 255, 0.07) 1px, transparent 1px),
    linear-gradient(90deg, rgba(120, 160, 255, 0.07) 1px, transparent 1px);
  background-size: 48px 48px;
  -webkit-mask-image: radial-gradient(ellipse at center, black 30%, transparent 75%);
  mask-image: radial-gradient(ellipse at center, black 30%, transparent 75%);
  opacity: 0.7;
}

.login-orb {
  position: absolute;
  border-radius: 50%;
  filter: blur(40px);
  opacity: 0.45;
}

.login-orb--a {
  width: 280px;
  height: 280px;
  left: 8%;
  top: 18%;
  background: radial-gradient(circle, rgba(47, 111, 237, 0.55), transparent 70%);
  animation: login-orb-a 18s ease-in-out infinite alternate;
}

.login-orb--b {
  width: 320px;
  height: 320px;
  right: 6%;
  bottom: 10%;
  background: radial-gradient(circle, rgba(56, 189, 248, 0.35), transparent 70%);
  animation: login-orb-b 22s ease-in-out infinite alternate;
}

.login-scan {
  position: absolute;
  left: 0;
  right: 0;
  height: 120px;
  top: -120px;
  background: linear-gradient(
    to bottom,
    transparent,
    rgba(120, 170, 255, 0.06),
    transparent
  );
  animation: login-scan 9s linear infinite;
}

.login-card {
  position: relative;
  z-index: 1;
  width: 100%;
  max-width: 360px;
  background: rgba(12, 18, 32, 0.72) !important;
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border: 1px solid var(--login-border);
  border-radius: 12px;
  box-shadow:
    0 0 0 1px rgba(255, 255, 255, 0.03) inset,
    0 20px 50px rgba(0, 0, 0, 0.45);
  animation: login-card-breathe 4.5s ease-in-out infinite;
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
  border-color: rgba(140, 180, 255, 0.55);
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
  border-bottom: 1px solid rgba(140, 170, 255, 0.16);
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
  color: rgba(210, 220, 245, 0.88);
}

.login-card :deep(.ant-input-affix-wrapper),
.login-card :deep(.ant-input) {
  background: rgba(6, 10, 20, 0.65);
  border-color: rgba(120, 150, 210, 0.35);
  color: var(--login-text);
}

.login-card :deep(.ant-input-affix-wrapper:hover),
.login-card :deep(.ant-input:hover),
.login-card :deep(.ant-input-affix-wrapper-focused),
.login-card :deep(.ant-input:focus) {
  border-color: var(--login-accent);
  box-shadow: 0 0 0 2px var(--login-accent-soft);
}

.login-card :deep(.ant-input::placeholder) {
  color: rgba(160, 175, 210, 0.45);
}

.login-card :deep(.ant-input-password-icon),
.login-card :deep(.ant-input-clear-icon) {
  color: rgba(180, 195, 230, 0.65);
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
  color: #ff8e8e;
}

@keyframes login-orb-a {
  from {
    transform: translate(0, 0);
  }
  to {
    transform: translate(36px, 28px);
  }
}

@keyframes login-orb-b {
  from {
    transform: translate(0, 0);
  }
  to {
    transform: translate(-42px, -24px);
  }
}

@keyframes login-scan {
  from {
    transform: translateY(0);
  }
  to {
    transform: translateY(calc(100vh + 120px));
  }
}

@keyframes login-card-breathe {
  0%,
  100% {
    border-color: rgba(140, 170, 255, 0.28);
  }
  50% {
    border-color: rgba(140, 170, 255, 0.48);
  }
}

@media (prefers-reduced-motion: reduce) {
  .login-orb--a,
  .login-orb--b,
  .login-scan,
  .login-card {
    animation: none;
  }
}

@media (max-width: 480px) {
  .login-orb {
    opacity: 0.28;
  }

  .login-card__header {
    flex-wrap: wrap;
  }
}
</style>
