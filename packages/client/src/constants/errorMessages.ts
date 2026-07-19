export const ERROR_MESSAGES = {
  username: {
    required: '请输入用户名',
    format: '用户名只能包含字母、数字和下划线',
    length: '用户名长度需为 4-20 位',
  },
  password: {
    required: '请输入密码',
    format: '密码只能包含字母、数字及特殊符号 @!#$%^&*()_-+=',
    uppercase: '密码需包含至少一个大写字母',
    length: '密码长度需为 8-20 位',
  },
  phone: {
    required: '请输入手机号',
    format: '手机号格式不正确，请输入 6-15 位数字',
  },
  smsCode: {
    required: '请输入验证码',
    format: '验证码需为 6 位数字',
  },
  sendSmsCode: {
    rateLimited: '请求过于频繁，请稍后再试',
    failed: '获取验证码失败，请重试',
  },
} as const;
