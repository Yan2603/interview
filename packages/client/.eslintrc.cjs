/* eslint-env node */
module.exports = {
  root: true,
  env: {
    browser: true,
    es2021: true,
  },
  extends: ['plugin:vue/vue3-recommended'],
  parser: 'vue-eslint-parser',
  parserOptions: {
    parser: '@typescript-eslint/parser',
    ecmaVersion: 'latest',
    sourceType: 'module',
    extraFileExtensions: ['.vue'],
  },
  rules: {
    // Vue 3 + Ant Design Vue use v-model:value, v-model:open, etc.
    'vue/no-v-model-argument': 'off',
    'vue/multi-word-component-names': 'off',
  },
};
