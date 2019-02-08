module.exports = {
  extends: require.resolve('@vzh/configs/eslint/ts.common.eslintrc.js'),
  
  rules: {
    'no-empty-function': 'off',
    '@typescript-eslint/array-type': 'off',
    '@typescript-eslint/no-empty-interface': 'off',
  },
};
