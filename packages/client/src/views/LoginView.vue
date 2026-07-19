<script setup lang="ts">
import { computed, h, onUnmounted, reactive, ref } from 'vue';
import { message } from 'ant-design-vue';
import { EyeInvisibleOutlined, EyeOutlined } from '@ant-design/icons-vue';
import { api } from '../api';
import { getErrorMessage } from '../utils/error';
import { COUNTRY_CODES, DEFAULT_COUNTRY_CODE } from '../constants/countryCodes';
import { validatePassword, validatePhone, validateSmsCode, validateUsername } from '../utils/validators';

const form = reactive({
  username: '',
  password: '',
  dialCode: DEFAULT_COUNTRY_CODE.dialCode,
  phone: '',
  smsCode: '',
});

const touched = reactive({
  username: false,
  password: false,
  phone: false,
  smsCode: false,
});

const passwordVisible = ref(false);
const countdown = ref(0);
const sending = ref(false);
let countdownTimer: ReturnType<typeof setInterval> | undefined;

const dialCodeOptions = COUNTRY_CODES.map((c) => ({
  value: c.dialCode,
  label: `+${c.dialCode} ${c.name}`,
}));

const usernameResult = computed(() => validateUsername(form.username));
const passwordResult = computed(() => validatePassword(form.password));
const phoneResult = computed(() => validatePhone(form.phone));
const smsCodeResult = computed(() => validateSmsCode(form.smsCode));

const usernameError = computed(() =>
  touched.username && !usernameResult.value.valid ? usernameResult.value.message : undefined,
);
const passwordError = computed(() =>
  touched.password && !passwordResult.value.valid ? passwordResult.value.message : undefined,
);
const phoneError = computed(() =>
  touched.phone && !phoneResult.value.valid ? phoneResult.value.message : undefined,
);
const smsCodeError = computed(() =>
  touched.smsCode && !smsCodeResult.value.valid ? smsCodeResult.value.message : undefined,
);

function markTouched(field: keyof typeof touched) {
  touched[field] = true;
}

const canSubmit = computed(
  () =>
    usernameResult.value.valid &&
    passwordResult.value.valid &&
    phoneResult.value.valid &&
    smsCodeResult.value.valid,
);

const canSendCode = computed(() => phoneResult.value.valid && countdown.value === 0 && !sending.value);

const sendCodeText = computed(() =>
  countdown.value > 0 ? `${countdown.value}s 后重新获取` : '获取验证码',
);
const sendCodeAriaLabel = computed(() =>
  countdown.value > 0 ? `${countdown.value} 秒后可重新获取验证码` : '获取验证码',
);

function startCountdown() {
  countdown.value = 60;
  countdownTimer = setInterval(() => {
    countdown.value -= 1;
    if (countdown.value <= 0) {
      clearInterval(countdownTimer);
      countdownTimer = undefined;
    }
  }, 1000);
}

async function handleSendCode() {
  if (!canSendCode.value) return;
  sending.value = true;
  try {
    await api.sendSmsCode(form.phone, form.dialCode);
    startCountdown();
  } catch (err) {
    message.error(getErrorMessage(err));
  } finally {
    sending.value = false;
  }
}

function handleSubmit() {
  markTouched('username');
  markTouched('password');
  markTouched('phone');
  markTouched('smsCode');
  if (!canSubmit.value) return;
  // TODO: 后续鉴权提案接入真实登录接口 POST /api/auth/login
  message.success('登录成功（mock）');
}

function passwordIconRender(visible: boolean) {
  return h(visible ? EyeOutlined : EyeInvisibleOutlined, {
    'aria-label': visible ? '隐藏密码' : '显示密码',
    role: 'img',
  });
}

function handleKeydownEnter() {
  if (canSubmit.value) {
    handleSubmit();
  }
}

onUnmounted(() => {
  if (countdownTimer) {
    clearInterval(countdownTimer);
  }
});
</script>

<template>
  <div class="login-page">
    <div class="login-card">
      <h1 class="login-title">面试驾驶舱</h1>

      <form @submit.prevent="handleSubmit">
        <a-form layout="vertical">
          <a-form-item label="用户名" :validate-status="usernameError ? 'error' : ''">
            <a-input
              v-model:value="form.username"
              autocomplete="username"
              :aria-invalid="!!usernameError"
              :aria-describedby="usernameError ? 'username-error' : undefined"
              @blur="markTouched('username')"
              @keydown.enter="handleKeydownEnter"
            />
            <div v-if="usernameError" id="username-error" role="alert" aria-live="polite" class="field-error">
              {{ usernameError }}
            </div>
          </a-form-item>

          <a-form-item label="密码" :validate-status="passwordError ? 'error' : ''">
            <a-input-password
              v-model:value="form.password"
              v-model:visible="passwordVisible"
              :icon-render="passwordIconRender"
              autocomplete="new-password"
              :aria-invalid="!!passwordError"
              :aria-describedby="passwordError ? 'password-error' : undefined"
              @blur="markTouched('password')"
              @keydown.enter="handleKeydownEnter"
            />
            <div v-if="passwordError" id="password-error" role="alert" aria-live="polite" class="field-error">
              {{ passwordError }}
            </div>
          </a-form-item>

          <a-form-item label="手机号" :validate-status="phoneError ? 'error' : ''">
            <a-input-group compact style="display: flex">
              <a-select
                v-model:value="form.dialCode"
                :options="dialCodeOptions"
                style="width: 140px; flex-shrink: 0"
              />
              <a-input
                v-model:value="form.phone"
                autocomplete="tel-national"
                style="flex: 1"
                :aria-invalid="!!phoneError"
                :aria-describedby="phoneError ? 'phone-error' : undefined"
                @blur="markTouched('phone')"
                @keydown.enter="handleKeydownEnter"
              />
            </a-input-group>
            <div v-if="phoneError" id="phone-error" role="alert" aria-live="polite" class="field-error">
              {{ phoneError }}
            </div>
          </a-form-item>

          <a-form-item label="短信验证码" :validate-status="smsCodeError ? 'error' : ''">
            <a-input-group compact style="display: flex">
              <a-input
                v-model:value="form.smsCode"
                style="flex: 1"
                :aria-invalid="!!smsCodeError"
                :aria-describedby="smsCodeError ? 'sms-code-error' : undefined"
                @blur="markTouched('smsCode')"
                @keydown.enter="handleKeydownEnter"
              />
              <a-button
                :disabled="!canSendCode"
                :loading="sending"
                :aria-label="sendCodeAriaLabel"
                style="flex-shrink: 0"
                @click="handleSendCode"
              >
                {{ sendCodeText }}
              </a-button>
            </a-input-group>
            <div v-if="smsCodeError" id="sms-code-error" role="alert" aria-live="polite" class="field-error">
              {{ smsCodeError }}
            </div>
          </a-form-item>

          <a-button
            type="primary"
            block
            :disabled="!canSubmit"
            @click="handleSubmit"
          >
            登录
          </a-button>
        </a-form>
      </form>
    </div>
  </div>
</template>

<style scoped>
.login-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f5f5f5;
}

.login-card {
  width: 380px;
  padding: 32px;
  background: #fff;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
}

.login-title {
  margin: 0 0 24px;
  font-size: 20px;
  font-weight: 600;
  text-align: center;
  color: #262626;
}

.field-error {
  margin-top: 4px;
  font-size: 12px;
  color: #ff4d4f;
}
</style>
