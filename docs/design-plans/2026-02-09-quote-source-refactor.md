# QuoteSource & KeywordSource Refactor Design

## Summary

This refactor separates data access contracts from data access implementations by converting `QuoteSource` from an interface to an abstract class and introducing a new `KeywordSource` interface. The game-generator package becomes a pure computational library with no file I/O, while the api package owns all data source implementations. The abstract `QuoteSource` class provides shared behavior for seeded random selection, ID lookup, and eager validation, requiring subclasses to implement only a single `getAllQuotes()` method. Similarly, `KeywordCipherGenerator` accepts a `KeywordSource` interface for retrieving cipher keywords, enabling future database-backed implementations without changing the core game generation logic. The existing Awilix dependency injection container wires these implementations at the api layer.

This design follows existing codebase patterns: constructor injection, interface-based abstraction, and centralized DI wiring. The primary divergence is using an abstract class instead of an interface for `QuoteSource`, justified by the need to share deterministic selection logic across all implementations. Implementation proceeds in four phases: converting the interface to an abstract class, moving the file I/O implementation to the api package, adding keyword source injection, and updating documentation.

## Definition of Done

- `QuoteSource` is an abstract class in game-generator with `getAllQuotes()` as the sole abstract method
- `getQuote()`, `getRandomQuote()`, and `ensureLoaded()` are concrete methods on the abstract class
- `JsonQuoteSource` lives in the api package, extends `QuoteSource`, implements only `getAllQuotes()`
- `KeywordSource` interface exists in game-generator
- `KeywordCipherGenerator` accepts `KeywordSource` via constructor injection
- `StaticKeywordSource` exists in the api package, wrapping the exported `KEYWORDS` constant
- DI container wires both sources
- game-generator has zero `node:fs` imports in production code
- All existing tests pass; new tests cover abstract class behavior and keyword source injection

## Glossary

- **Abstract class**: A class that cannot be instantiated directly and may contain both abstract methods (declared but not implemented) and concrete methods (fully implemented). Subclasses must implement the abstract methods but inherit the concrete ones.
- **Awilix**: A dependency injection container library for JavaScript that manages object lifecycle and wiring. Used in the api package to compose dependencies.
- **Constructor injection**: A dependency injection pattern where dependencies are provided as parameters to a class constructor rather than created internally or accessed globally.
- **game-generator**: A package within the api pnpm monorepo that contains the core puzzle generation logic. This refactor makes it pure (no I/O operations).
- **node:fs**: Node.js built-in filesystem module used for reading and writing files. This refactor eliminates its use in game-generator production code.
- **Seeded selection**: Random selection using a seed value (like a date) to produce deterministic results — the same seed always produces the same selection.

## Architecture

This refactor separates data access contracts (interfaces/abstract classes) from data access implementations (file I/O, future database). The game-generator package becomes a pure computational library with no I/O. The api package owns all I/O implementations and wires them via the existing Awilix DI container.

### QuoteSource: Interface to Abstract Class

`QuoteSource` in `api/packages/game-generator/src/quotes/types.ts` changes from an interface to an abstract class. The abstract class provides:

- `abstract getAllQuotes(): Promise<Quote[]>` — sole abstract method, implemented by subclasses
- `getQuote(id: string): Promise<Quote | null>` — concrete, scans `getAllQuotes()` result
- `getRandomQuote(seed?: string): Promise<Quote>` — concrete, uses seeded RNG from `random.ts`
- `ensureLoaded(): Promise<void>` — concrete, calls `getAllQuotes()` for fail-fast startup validation

Subclasses only implement `getAllQuotes()`. Seeded selection, ID lookup, and eager validation are inherited.

```typescript
// Contract: game-generator/src/quotes/types.ts
export abstract class QuoteSource {
  abstract getAllQuotes(): Promise<Quote[]>;

  async getQuote(id: string): Promise<Quote | null> {
    const quotes = await this.getAllQuotes();
    return quotes.find((q) => q.id === id) ?? null;
  }

  async getRandomQuote(seed?: string): Promise<Quote> {
    const quotes = await this.getAllQuotes();
    // ... seeded selection using hashString/createSeededRng/selectFromArray
  }

  async ensureLoaded(): Promise<void> {
    await this.getAllQuotes();
  }
}
```

### KeywordSource: New Interface

`KeywordSource` is a new interface in game-generator. It provides a list of keywords for cipher generation:

```typescript
// Contract: game-generator/src/cipher/types.ts
export interface KeywordSource {
  getKeywords(): Promise<readonly string[]>;
}
```

`KeywordCipherGenerator` accepts `KeywordSource` via constructor alongside `QuoteSource`:

```typescript
// Contract: game-generator/src/cipher/keyword-cipher.ts
export class KeywordCipherGenerator implements GameGenerator {
  constructor(
    private readonly quoteSource: QuoteSource,
    private readonly keywordSource: KeywordSource,
  ) {}
}
```

### Implementation Locations

| Component | Package | Why |
|-----------|---------|-----|
| `QuoteSource` abstract class | game-generator | Owns determinism contract + seeded selection |
| `KeywordSource` interface | game-generator | Defines keyword retrieval contract |
| `KEYWORDS` constant | game-generator | Static data, no I/O |
| `JsonQuoteSource` class | api (`src/sources/`) | File I/O implementation |
| `StaticKeywordSource` class | api (`src/sources/`) | Wraps exported `KEYWORDS` constant |
| DI wiring | api (`src/deps/singleton.ts`) | Composition root, unchanged role |

### Data Flow (Unchanged)

The external data flow is unchanged. Internally, game-generator no longer performs file I/O — the api package provides loaded data through the abstract class contract.

## Existing Patterns

Investigation found the following patterns this design follows:

- **DI container as composition root**: `api/packages/api/src/deps/singleton.ts` already wires `QuoteSource` and `GameGenerator` implementations from game-generator. This refactor moves the implementations closer to the composition root.
- **Constructor injection**: `KeywordCipherGenerator` already takes `QuoteSource` via constructor. Adding `KeywordSource` follows the same pattern.
- **Interface-based abstraction**: `GameGenerator` interface in `api/packages/game-generator/src/cipher/types.ts` already defines the cipher contract. `KeywordSource` follows this pattern.
- **Test helpers centralize mock creation**: `api/packages/api/tests/helpers/test-container.ts` provides `createMockQuoteSource()` and `createMockGameGenerator()`. Mock creation will be updated here.

**Divergence from existing patterns:**

- `QuoteSource` changes from interface to abstract class. This is justified because the seeded selection logic is shared behavior that belongs with the contract, not with each I/O implementation. Abstract classes are appropriate when shared behavior accompanies the contract.
- Test mocks for `QuoteSource` change from plain object literals to class extensions. This affects inline mocks in `puzzle.test.ts` and `solution.test.ts` (which currently create `{ getQuote, getRandomQuote }` objects). These become subclass instances or use the centralized test helper.

## Implementation Phases

<!-- START_PHASE_1 -->
### Phase 1: Convert QuoteSource to Abstract Class

**Goal:** Transform `QuoteSource` from an interface to an abstract class with shared behavior, keeping `JsonQuoteSource` in game-generator for now.

**Components:**
- `QuoteSource` abstract class in `api/packages/game-generator/src/quotes/types.ts` — single abstract method `getAllQuotes()`, concrete `getQuote()`, `getRandomQuote()`, `ensureLoaded()`
- `JsonQuoteSource` in `api/packages/game-generator/src/quotes/json-source.ts` — extends abstract class, implements only `getAllQuotes()` (remove `getQuote`, `getRandomQuote`, `ensureLoaded` which are now inherited)
- Tests for abstract class behavior in `api/packages/game-generator/src/quotes/`

**Dependencies:** None (first phase)

**Done when:** All existing game-generator and api tests pass. New tests verify abstract class `getQuote`, `getRandomQuote`, and `ensureLoaded` behavior via a minimal test subclass.
<!-- END_PHASE_1 -->

<!-- START_PHASE_2 -->
### Phase 2: Move JsonQuoteSource to API Package

**Goal:** Relocate `JsonQuoteSource` from game-generator to api, making game-generator free of `node:fs` imports.

**Components:**
- `JsonQuoteSource` in `api/packages/api/src/sources/json-quote-source.ts` — moved from game-generator, extends `QuoteSource` from `@unquote/game-generator`
- `api/packages/api/src/sources/index.ts` — barrel export
- `api/packages/game-generator/src/index.ts` — remove `JsonQuoteSource` export
- `api/packages/api/src/deps/singleton.ts` — import `JsonQuoteSource` from local `sources/` instead of `@unquote/game-generator`
- Integration tests in `api/packages/api/src/domain/game/routes/` — update imports
- `JsonQuoteSource` tests relocated from game-generator to api
- Test mock updates in `api/packages/api/tests/helpers/test-container.ts` and inline mocks in `puzzle.test.ts`, `solution.test.ts` — adapt to abstract class (subclass instead of plain object)

**Dependencies:** Phase 1 (abstract class exists)

**Done when:** game-generator has zero `node:fs` imports in `src/` (excluding tests). All api tests pass with `JsonQuoteSource` imported from `src/sources/`. Integration tests use relocated class.
<!-- END_PHASE_2 -->

<!-- START_PHASE_3 -->
### Phase 3: Add KeywordSource Interface and Injection

**Goal:** Make keyword selection injectable, enabling future database-backed keyword sources.

**Components:**
- `KeywordSource` interface in `api/packages/game-generator/src/cipher/types.ts`
- `KeywordCipherGenerator` in `api/packages/game-generator/src/cipher/keyword-cipher.ts` — accepts `KeywordSource` as second constructor parameter, calls `keywordSource.getKeywords()` instead of importing `KEYWORDS` directly
- `KEYWORDS` constant in `api/packages/game-generator/src/data/keywords.ts` — exported from package index for consumption by `StaticKeywordSource`
- `StaticKeywordSource` in `api/packages/api/src/sources/static-keyword-source.ts` — implements `KeywordSource`, wraps `KEYWORDS`
- `api/packages/api/src/deps/singleton.ts` — register `keywordSource` in DI container, pass to `KeywordCipherGenerator`
- DI type extensions updated for `keywordSource` in cradle

**Dependencies:** Phase 2 (sources directory established)

**Done when:** `KeywordCipherGenerator` no longer directly imports `KEYWORDS`. DI container wires `StaticKeywordSource`. All tests pass including updated cipher tests and DI tests.
<!-- END_PHASE_3 -->

<!-- START_PHASE_4 -->
### Phase 4: Documentation Updates

**Goal:** Update project documentation to reflect new architecture.

**Components:**
- `api/packages/game-generator/CLAUDE.md` — update boundary description ("pure library with no I/O"), remove `JsonQuoteSource` from exports, add `KeywordSource` interface, add `KEYWORDS` to exports
- `api/packages/api/CLAUDE.md` — add `src/sources/` to key files, document `JsonQuoteSource` and `StaticKeywordSource`
- `api/packages/api/src/deps/CLAUDE.md` — update contracts for `keywordSource` in cradle
- `docs/CODEBASE_MAP.md` — update module guide to reflect moved `JsonQuoteSource` and new `KeywordSource`

**Dependencies:** Phase 3

**Done when:** Documentation accurately reflects new architecture. No stale references to `JsonQuoteSource` in game-generator docs.
<!-- END_PHASE_4 -->

## Additional Considerations

**Abstract class and test mocking:** Changing `QuoteSource` from an interface to an abstract class means test mocks can no longer be plain object literals (`{ getQuote, getRandomQuote }`). Tests must create subclass instances instead. This affects inline mocks in `puzzle.test.ts` and `solution.test.ts` and the centralized `createMockQuoteSource()` helper. The migration is mechanical — the mock subclass only needs `getAllQuotes()` returning a fixed array.

**`generateDailyPuzzle` becomes sync-capable:** Currently `KeywordCipherGenerator.generateDailyPuzzle` is async because it calls `quoteSource.getRandomQuote()`. After this refactor, `keywordSource.getKeywords()` is also async. The method signature stays `async` — no change needed.

**Future database migration path:** With this refactor in place, adding database-backed sources requires only: (1) a new `DbQuoteSource extends QuoteSource` implementing `getAllQuotes()`, and (2) a new `DbKeywordSource implements KeywordSource` implementing `getKeywords()`. No changes to game-generator. The DI container swaps implementations by config.
