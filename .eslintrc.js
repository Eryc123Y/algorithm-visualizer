module.exports = {
  env: {
    browser: true,
    es2021: true,
    node: true,
  },
  extends: [
    'eslint:recommended',
    'plugin:vue/vue3-recommended', // Vue 3 的推荐规则
    'plugin:@typescript-eslint/recommended', // TypeScript 的推荐规则
    'plugin:prettier/recommended', // Prettier 的集成
  ],
  parser: 'vue-eslint-parser', // 用于解析 Vue SFC 的解析器
  parserOptions: {
    parser: '@typescript-eslint/parser', // 支持 TypeScript
    ecmaVersion: 2020,
    sourceType: 'module',
  },
  rules: {
    'prettier/prettier': [
      'error',
      {
        endOfLine: 'auto',
      },
    ], // 确保 Prettier 格式问题被标记为错误
    'vue/multi-word-component-names': 'off', // 允许单词组件名称
  },
};
