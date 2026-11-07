const { defineConfig } = require('eslint/config');
const expo = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expo,
  { ignores: ['dist/*', '.expo/*'] },
  {
    rules: {
      // Apostrophes in React Native <Text> are fine; this rule is for HTML.
      'react/no-unescaped-entities': 'off',
      // Match the web console's style (Array<T>) so the copied helpers stay identical.
      '@typescript-eslint/array-type': 'off',
      // These two are checks for the React Compiler, which this app does not use. React Native's documented way to animate is a
      // ref holding an Animated.Value and an effect that starts it, which they flag.
      'react-hooks/refs': 'off',
      'react-hooks/set-state-in-effect': 'off',
    },
  },
  // A zod schema and the type inferred from it share a name on purpose.
  { files: ['src/api/schema.ts'], rules: { '@typescript-eslint/no-redeclare': 'off' } },
]);
