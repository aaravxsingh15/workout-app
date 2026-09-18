const { defineConfig } = require('eslint/config');
const expo = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expo,
  {
    ignores: ['scripts/*.js', 'dist/*', '.tmp-export/*', 'supabase/functions/*', 'node_modules/*'],
  },
  {
    rules: {
      'react-hooks/exhaustive-deps': 'warn',
    },
  },
]);
