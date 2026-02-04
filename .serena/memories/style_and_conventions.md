# Code Style and Conventions

## Commit Messages

Use [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <description>
```

### Types
- `feat` - New user-facing feature
- `fix` - User-facing bug fix
- `docs` - Documentation only
- `refactor` - Code change that neither fixes a bug nor adds a feature
- `test` - Adding or correcting tests
- `build` - Build system or external dependencies
- `perf` - Performance improvement
- `ci` - CI configuration
- `chore` - Other changes

### Scopes
- `api` - API server changes
- `game-generator` - Puzzle generation library changes
- `tui` - TUI changes

### Guidelines
- Describe WHAT changed and WHY, not HOW
- Use imperative mood ("add" not "added")
- Keep first line under 72 characters

### Examples
```
feat(api): add endpoint to retrieve daily puzzle
fix(tui): correct letter substitution display on narrow terminals
build(api): upgrade express to v5
test(game-generator): add property tests for cipher bijection
```

## TypeScript (API)

- **Validation**: Use TypeBox schemas, not manual typeof checks
- **IDs**: Use nanoid-style random strings, not sequential numbers
- **No FCIS comments**: The Functional Core/Imperative Shell pattern is implicit, don't document in code

## Go (TUI)

- **Internal packages**: All packages under `internal/` to prevent external imports
- **No FCIS comments**: Pattern is implicit, don't document in code
- **Testing**: Use `NewWithClient()` for testing without live API
- **Value receivers**: Prefer for methods that don't modify state

## Testing

### API (Vitest)
- Test files: `*.test.ts` and `*.property.test.ts`
- Test containers: Use `createTestContainer()` from `tests/helpers/`
- Override pattern: Pass partial options to replace dependencies
- Property testing: fast-check for invariant testing

### TUI (Go)
- Test files: `*_test.go`
- Table-driven tests preferred
- Test alongside source files in same package

## Documentation

- Each major component has a `CLAUDE.md` with:
  - Last verified date
  - Contracts (Exposes, Guarantees, Expects, Invariants)
  - Key decisions
  - Anti-patterns to avoid
