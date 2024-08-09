/** @type {import('eslint').Linter.Config[]} */
module.exports = [
  ...require('@js-toolkit/configs/eslint/common'),

  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
];
