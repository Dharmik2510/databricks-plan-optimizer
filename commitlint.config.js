export default {
    extends: ['@commitlint/config-conventional'],
    rules: {
        'type-enum': [
            2,
            'always',
            [
                'feat',     // New feature
                'fix',      // Bug fix
                'docs',     // Documentation only
                'style',    // Formatting, missing semi colons, etc
                'refactor', // Code change that neither fixes a bug nor adds a feature
                'perf',     // Performance improvement
                'test',     // Adding missing tests
                'chore',    // Maintenance tasks
                'revert',   // Reverts a previous commit
                'ci',       // CI/CD changes
                'build',    // Build system changes
            ],
        ],
        'subject-case': [2, 'always', 'lower-case'],
        'header-max-length': [2, 'always', 100],
    },
};
