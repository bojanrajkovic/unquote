# Game Generator

Last verified: 2026-02-08

## Purpose

Transforms quotes into cryptoquip puzzles with deterministic daily generation. Enables the API to serve consistent daily puzzles where the same date always produces the same puzzle.

## Contracts

- **Exposes**: `Quote`, `Puzzle`, `Hint`, `CipherMapping` types; `QuoteSchema` schema; `QuoteSource`, `GameGenerator` interfaces; `InMemoryQuoteSource`, `KeywordCipherGenerator` implementations; `validateSolution` function
- **Guarantees**: Same seed produces identical cipher mapping. Daily puzzles are deterministic by date. Cipher mappings are bijective (no letter maps to itself or shares a mapping).
- **Expects**: Valid Quote objects with id, text, author, category, difficulty. Luxon DateTime for daily puzzle generation.

## Dependencies

- **Uses**: Luxon (DateTime), TypeBox (schema validation), fast-check (property testing)
- **Used by**: API package (via DI container as `quoteSource` and `gameGenerator` singletons)
- **Boundary**: Pure library with zero `node:fs` imports in production code; quote data loaded via QuoteSource abstraction

## Shared Resources

Test and development quote data lives in `api/resources/quotes.json` (shared across packages), not within this package's source tree. The API package's `JsonQuoteSource` handles file I/O; game-generator consumers use `InMemoryQuoteSource` for testing.

## Key Decisions

- Keyword cipher algorithm: Uses memorable keywords to generate substitution, making puzzles feel crafted rather than random
- Seeded randomness: All randomness accepts optional seed for reproducibility in tests and daily puzzles
- TypeBox schemas: Use `typebox` for validation (not manual typeof checks)
- nanoid-style IDs: Quote IDs are random strings (e.g., `tbwFfLG0D3I3UEhgU_qSr`), not sequential numbers

## Invariants

- Cipher mappings never map a letter to itself
- Every letter A-Z appears exactly once in the cipher output alphabet
- validateSolution is case-insensitive and whitespace-normalized

## Anti-Patterns (Do NOT Add)

- Functional Core/Imperative Shell comments - explicitly removed; the pattern is implicit
- Manual typeof validation - use TypeBox schemas instead
- Sequential quote IDs - use nanoid-style random strings

## Key Files

- `src/index.ts` - Public exports
- `src/types.ts` - Core types (Quote, Puzzle, Hint, CipherMapping)
- `src/schemas.ts` - TypeBox validation schemas (QuoteSchema)
- `src/cipher/keyword-cipher.ts` - KeywordCipherGenerator implementation
- `src/quotes/in-memory-source.ts` - InMemoryQuoteSource implementation
- `src/validation.ts` - Solution validation
- `src/difficulty/scorer.ts` - 7-factor difficulty scoring algorithm (internal)

## Gotchas

- Difficulty scores are pre-computed on Quote objects, not calculated at puzzle generation time
- Hints reveal high-frequency letters to help players start; hint count varies by difficulty
- difficulty/scorer.ts and hints/generator.ts are internal modules (not exported from package)
