import { ERROR_MESSAGES } from '../constants/errorMessages';

export interface ValidationResult {
  valid: boolean;
  message?: string;
}

const USERNAME_CHARSET_RE = /^[A-Za-z0-9_]+$/;
const PASSWORD_CHARSET_RE = /^[A-Za-z0-9@!#$%^&*()_\-+=]+$/;
const PASSWORD_UPPERCASE_RE = /[A-Z]/;
const PHONE_RE = /^\d+$/;
const SMS_CODE_RE = /^\d{6}$/;

export function validateUsername(value: string): ValidationResult {
  if (!value) {
    return { valid: false, message: ERROR_MESSAGES.username.required };
  }
  if (!USERNAME_CHARSET_RE.test(value)) {
    return { valid: false, message: ERROR_MESSAGES.username.format };
  }
  if (value.length < 4 || value.length > 20) {
    return { valid: false, message: ERROR_MESSAGES.username.length };
  }
  return { valid: true };
}

export function validatePassword(value: string): ValidationResult {
  if (!value) {
    return { valid: false, message: ERROR_MESSAGES.password.required };
  }
  if (!PASSWORD_CHARSET_RE.test(value)) {
    return { valid: false, message: ERROR_MESSAGES.password.format };
  }
  if (!PASSWORD_UPPERCASE_RE.test(value)) {
    return { valid: false, message: ERROR_MESSAGES.password.uppercase };
  }
  if (value.length < 8 || value.length > 20) {
    return { valid: false, message: ERROR_MESSAGES.password.length };
  }
  return { valid: true };
}

export function validatePhone(value: string): ValidationResult {
  if (!value) {
    return { valid: false, message: ERROR_MESSAGES.phone.required };
  }
  if (!PHONE_RE.test(value) || value.length < 6 || value.length > 15) {
    return { valid: false, message: ERROR_MESSAGES.phone.format };
  }
  return { valid: true };
}

export function validateSmsCode(value: string): ValidationResult {
  if (!value) {
    return { valid: false, message: ERROR_MESSAGES.smsCode.required };
  }
  if (!SMS_CODE_RE.test(value)) {
    return { valid: false, message: ERROR_MESSAGES.smsCode.format };
  }
  return { valid: true };
}
