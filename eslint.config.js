/** @type {import('eslint').Linter.FlatConfig[]} */
module.exports = [
  ...require('@js-toolkit/configs/eslint/common'),

  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
];
