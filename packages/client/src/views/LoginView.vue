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
    <a-card class="login-card" title="登录">
      <a-form :model="form" layout="vertical" @finish="onSubmit">
        <a-form-item label="用户名" name="username" :rules="[{ required: true, message: '请输入用户名' }]">
          <a-input
            v-model:value="form.username"
            autocomplete="username"
            placeholder="用户名"
            allow-clear
          />
        </a-form-item>
        <a-form-item label="密码" name="password" :rules="[{ required: true, message: '请输入密码' }]">
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
  min-height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: #f5f5f5;
}

.login-card {
  width: 100%;
  max-width: 360px;
}
</style>
