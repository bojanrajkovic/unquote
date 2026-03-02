// Inline conventional commits configuration
// (avoids needing @commitlint/config-conventional as a dependency)
export default {
  plugins: [
    {
      rules: {
        // Built-in subject-case only supports whole-string casing (lower-case,
        // sentence-case, etc.). This custom rule enforces just the first
        // character so identifiers like getStats stay natural.
        'subject-first-char-case': ({ subject }) => {
          if (!subject) return [true];
          const first = subject[0];
          return [
            first === first.toLowerCase(),
            'subject must start with a lowercase letter',
          ];
        },
      },
    },
  ],
  rules: {
    // Type must be one of the allowed values
    'type-enum': [
      2,
      'always',
      ['feat', 'fix', 'docs', 'style', 'refactor', 'perf', 'test', 'build', 'ci', 'chore', 'revert'],
    ],
    'type-case': [2, 'always', 'lower-case'],
    'type-empty': [2, 'never'],

    // Scope rules (scope-enum disabled; PR title validation handles allowed scopes)
    'scope-case': [2, 'always', 'lower-case'],

    // Subject rules
    'subject-empty': [2, 'never'],
    'subject-first-char-case': [2, 'always'],
    'subject-full-stop': [2, 'never', '.'],

    // Header rules
    'header-max-length': [2, 'always', 72],

    // Body rules
    'body-leading-blank': [2, 'always'],
    'body-max-line-length': [2, 'always', 100],

    // Footer rules
    'footer-leading-blank': [2, 'always'],
    'footer-max-line-length': [2, 'always', 100],
  },
};
