# Task Completion Checklist

When completing tasks, run these commands:

## Linting
```bash
cd api && pnpm lint
```

## Type Checking
```bash
cd api && pnpm --filter @unquote/api typecheck
```

## Testing
```bash
cd api && pnpm test
```

## Building
```bash
cd api && pnpm build
```

## Full Verification
```bash
cd api && pnpm install && pnpm build && pnpm lint && pnpm test
```

## Git Commit Format
Follow Conventional Commits:
```
<type>(<scope>): <description>

- Item 1
- Item 2
```

Types: feat, fix, docs, refactor, test, build, perf, ci, chore
Scopes: api, tui
