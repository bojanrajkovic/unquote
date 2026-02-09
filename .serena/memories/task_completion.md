# Task Completion Checklist

## Before Committing Changes

### API Changes (from `api/` directory)

1. **Build**: `pnpm run build`
2. **Test**: `pnpm run test`
3. **Lint**: `pnpm run lint`
4. **Format**: `pnpm run format`
5. **Typecheck**: `pnpm run typecheck`

Or from the project root: `mise run //api:build`

### TUI Changes

From project root: `mise run //tui:ci` (runs fmt, vet, lint, test, build)

Or individual steps:
```bash
mise run //tui:fmt
mise run //tui:vet
mise run //tui:lint
mise run //tui:test
mise run //tui:build
```

### Build Everything

From project root: `mise run build`

## Commit Format

```bash
git commit -m "type(scope): description

Optional body explaining WHAT and WHY.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

- commitlint enforces **lowercase subject** after type/scope prefix
- lefthook runs pre-commit hooks and commit-msg validation

## After Major Changes

Consider updating CLAUDE.md files if:
- New packages/modules added
- API contracts changed
- New invariants or guarantees
- New anti-patterns discovered

Update "Last verified" date when reviewing documentation accuracy.

## Feature Branch Workflow

1. Create worktree: `git worktree add /tmp/unquote-<name> -b <branch>`
2. Trust mise in worktree: `mise trust /tmp/unquote-<name>`
3. Implement feature with tests
4. Run all verification commands
5. Commit with conventional commit message
6. Merge or create PR
7. Clean up: `git worktree remove /tmp/unquote-<name>`
