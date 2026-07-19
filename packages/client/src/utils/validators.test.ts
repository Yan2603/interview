import { describe, expect, it } from 'vitest';
import { ERROR_MESSAGES } from '../constants/errorMessages';
import { validatePassword, validatePhone, validateSmsCode, validateUsername } from './validators';

describe('validateUsername', () => {
  it('rejects empty value', () => {
    expect(validateUsername('')).toEqual({ valid: false, message: ERROR_MESSAGES.username.required });
  });

  it('rejects illegal characters', () => {
    expect(validateUsername('bad name!')).toEqual({ valid: false, message: ERROR_MESSAGES.username.format });
  });

  it('rejects length below minimum (3 chars)', () => {
    expect(validateUsername('abc')).toEqual({ valid: false, message: ERROR_MESSAGES.username.length });
  });

  it('accepts length at minimum boundary (4 chars)', () => {
    expect(validateUsername('abcd')).toEqual({ valid: true });
  });

  it('accepts length at maximum boundary (20 chars)', () => {
    expect(validateUsername('a'.repeat(20))).toEqual({ valid: true });
  });

  it('rejects length above maximum (21 chars)', () => {
    expect(validateUsername('a'.repeat(21))).toEqual({ valid: false, message: ERROR_MESSAGES.username.length });
  });

  it('accepts letters, digits, and underscores', () => {
    expect(validateUsername('user_123')).toEqual({ valid: true });
  });
});

describe('validatePassword', () => {
  it('rejects empty value', () => {
    expect(validatePassword('')).toEqual({ valid: false, message: ERROR_MESSAGES.password.required });
  });

  it('rejects illegal characters', () => {
    expect(validatePassword('Abc12345中')).toEqual({ valid: false, message: ERROR_MESSAGES.password.format });
  });

  it('rejects missing uppercase letter', () => {
    expect(validatePassword('abc12345')).toEqual({ valid: false, message: ERROR_MESSAGES.password.uppercase });
  });

  it('rejects length below minimum (7 chars)', () => {
    expect(validatePassword('Abc1234')).toEqual({ valid: false, message: ERROR_MESSAGES.password.length });
  });

  it('accepts length at minimum boundary (8 chars)', () => {
    expect(validatePassword('Abcd1234')).toEqual({ valid: true });
  });

  it('accepts length at maximum boundary (20 chars)', () => {
    expect(validatePassword(`A${'b'.repeat(19)}`)).toEqual({ valid: true });
  });

  it('rejects length above maximum (21 chars)', () => {
    expect(validatePassword(`A${'b'.repeat(20)}`)).toEqual({ valid: false, message: ERROR_MESSAGES.password.length });
  });

  it('accepts allowed special characters with uppercase', () => {
    expect(validatePassword('Ab1!@#$%^&*()_-+=')).toEqual({ valid: true });
  });
});

describe('validatePhone', () => {
  it('rejects empty value', () => {
    expect(validatePhone('')).toEqual({ valid: false, message: ERROR_MESSAGES.phone.required });
  });

  it('rejects non-digit characters', () => {
    expect(validatePhone('12345a')).toEqual({ valid: false, message: ERROR_MESSAGES.phone.format });
  });

  it('rejects length below minimum (5 digits)', () => {
    expect(validatePhone('12345')).toEqual({ valid: false, message: ERROR_MESSAGES.phone.format });
  });

  it('accepts length at minimum boundary (6 digits)', () => {
    expect(validatePhone('123456')).toEqual({ valid: true });
  });

  it('accepts length at maximum boundary (15 digits)', () => {
    expect(validatePhone('1'.repeat(15))).toEqual({ valid: true });
  });

  it('rejects length above maximum (16 digits)', () => {
    expect(validatePhone('1'.repeat(16))).toEqual({ valid: false, message: ERROR_MESSAGES.phone.format });
  });
});

describe('validateSmsCode', () => {
  it('rejects empty value', () => {
    expect(validateSmsCode('')).toEqual({ valid: false, message: ERROR_MESSAGES.smsCode.required });
  });

  it('rejects fewer than 6 digits', () => {
    expect(validateSmsCode('12345')).toEqual({ valid: false, message: ERROR_MESSAGES.smsCode.format });
  });

  it('rejects more than 6 digits', () => {
    expect(validateSmsCode('1234567')).toEqual({ valid: false, message: ERROR_MESSAGES.smsCode.format });
  });

  it('rejects non-digit characters', () => {
    expect(validateSmsCode('12345a')).toEqual({ valid: false, message: ERROR_MESSAGES.smsCode.format });
  });

  it('accepts exactly 6 digits', () => {
    expect(validateSmsCode('123456')).toEqual({ valid: true });
  });
});
