# Game Generator Package Design

## Summary

New `@unquote/game-generator` package providing cryptoquip puzzle generation using keyword substitution cipher. Exposes `QuoteSource` and `GameGenerator` interfaces with JSON and keyword cipher implementations respectively. Includes difficulty scoring, hint generation, and solution validation. Daily puzzles are deterministic from date.

## Definition of Done

1. **New package `@unquote/game-generator`** in `api/packages/game-generator/` with:
   - `QuoteSource` interface + JSON file implementation
   - `GameGenerator` interface + keyword cipher implementation
   - Difficulty scoring module (5-factor algorithm)
   - Hint generation (letter mapping reveals)
   - Solution validation (compare submitted text to original)

2. **Data types defined:**
   - `Quote` (id, text, author, category, difficulty)
   - `Puzzle` (encrypted text, cipher mapping, hints, quote reference)

3. **Daily puzzle generation:**
   - Deterministic from date (same date = same puzzle)
   - Uses date-seeded keyword selection

4. **Sample JSON quote file** with a handful of test quotes

## Glossary

- **Keyword cipher**: Substitution cipher where the cipher alphabet is built from a keyword followed by remaining unused letters
- **Cipher mapping**: Record mapping plaintext letters to ciphertext letters (e.g., `{ a: 'P', b: 'U', ... }`)
- **Hint**: A revealed letter mapping given to help the player (e.g., "X = T")
- **Difficulty score**: 0-100 rating of puzzle difficulty based on text characteristics

## Architecture

### Package Structure

```
api/packages/game-generator/
├── src/
│   ├── index.ts              # Public exports (minimal)
│   ├── types.ts              # Shared types (Quote, Puzzle, Hint, CipherMapping)
│   ├── validation.ts         # validateSolution pure function
│   ├── cipher/
│   │   ├── index.ts          # Module exports
│   │   ├── types.ts          # GameGenerator interface
│   │   └── keyword-cipher.ts # KeywordCipherGenerator class
│   ├── quotes/
│   │   ├── index.ts          # Module exports
│   │   ├── types.ts          # QuoteSource interface
│   │   └── json-source.ts    # JsonQuoteSource class
│   ├── difficulty/
│   │   ├── index.ts          # Module exports
│   │   └── scorer.ts         # scoreDifficulty function (5-factor)
│   └── hints/
│       ├── index.ts          # Module exports
│       └── generator.ts      # generateHints function
├── data/
│   └── quotes.json           # Sample quotes with pre-computed difficulty
├── package.json
└── tsconfig.json
```

### Core Types

```typescript
type Quote = {
  readonly id: string;
  readonly text: string;
  readonly author: string;
  readonly category: string;
  readonly difficulty: number;  // 0-100, pre-computed
};

type CipherMapping = Record<string, string>;  // plaintext → ciphertext

type Hint = {
  readonly cipherLetter: string;
  readonly plainLetter: string;
};

type Puzzle = {
  readonly quoteId: string;
  readonly encryptedText: string;
  readonly mapping: CipherMapping;
  readonly hints: ReadonlyArray<Hint>;
};
```

### Interfaces and Implementations

**QuoteSource** - abstraction over quote storage:
```typescript
interface QuoteSource {
  getQuote(id: string): Promise<Quote | null>;
  getRandomQuote(seed?: string): Promise<Quote>;
}

class JsonQuoteSource implements QuoteSource {
  constructor(private readonly filePath: string) {}
  // Caches quotes on first load
}
```

**GameGenerator** - abstraction over cipher algorithm:
```typescript
interface GameGenerator {
  generatePuzzle(quote: Quote, seed?: string): Puzzle;
  generateDailyPuzzle(date: Date): Promise<Puzzle>;
}

class KeywordCipherGenerator implements GameGenerator {
  constructor(private readonly quoteSource: QuoteSource) {}
}
```

Both designed for Awilix dependency injection.

### Pure Functions

**Difficulty Scoring** (5-factor algorithm):
- Text length (30%): Longer texts are harder
- Short word scarcity (25%): Fewer 1-2 letter words = harder
- Letter frequency evenness (20%): Even distribution = harder
- Pattern uniqueness (15%): Fewer repeated patterns = harder
- Digram frequency (10%): Common letter pairs aid solving

**Hint Generation**: Selects N letter mappings to reveal, prioritizing less common letters.

**Solution Validation**: Normalizes both strings (lowercase, collapse whitespace, trim) and compares. Pure function - API layer handles quote lookup.

### Daily Puzzle Flow

```
Date → seed → keyword → cipher alphabet → encrypt quote

1. Convert date to seed: "2026-01-29"
2. Use seed to select keyword from wordlist
3. Build cipher alphabet: keyword "PUZZLE" → PUZZLEABCDFGHIJKMNOQRSTVWXY
4. Map plaintext to ciphertext: A→P, B→U, C→Z, ...
5. Select quote (also seeded by date)
6. Apply cipher to quote text
7. Generate default hints (1-2 reveals)
```

Same date always produces identical puzzle.

### Public API (Minimal)

```typescript
// Types
export type { Quote, Puzzle, Hint, CipherMapping } from './types';

// Interfaces
export type { QuoteSource } from './quotes';
export type { GameGenerator } from './cipher';

// Implementations
export { JsonQuoteSource } from './quotes';
export { KeywordCipherGenerator } from './cipher';

// Pure functions
export { validateSolution } from './validation';
```

Internal functions (`scoreDifficulty`, `generateHints`) not exported initially.

## Existing Patterns

Follows conventions established in `@unquote/api`:
- pnpm workspace package with catalog dependencies
- TypeScript strict mode (@tsconfig/strictest + @tsconfig/node24)
- oxlint for linting, oxfmt for formatting
- Factory/class pattern for testable components
- Explicit return types on all exports

## Implementation Phases

### Phase 1: Package Setup
- Create package.json with workspace catalog references
- Create tsconfig.json extending base config
- Create src/index.ts and src/types.ts with core types
- Verify build works in monorepo

### Phase 2: Quote Source
- Define QuoteSource interface
- Implement JsonQuoteSource with file loading and caching
- Create sample quotes.json with 5-10 test quotes
- Add tests for JsonQuoteSource

### Phase 3: Cipher Implementation
- Define GameGenerator interface
- Implement keyword cipher alphabet generation
- Implement KeywordCipherGenerator class
- Add tests for cipher generation (deterministic verification)

### Phase 4: Difficulty and Hints
- Implement 5-factor difficulty scoring
- Implement hint generation
- Add difficulty scores to sample quotes
- Add tests for scoring and hints

### Phase 5: Validation and Integration
- Implement validateSolution pure function
- Wire up daily puzzle generation
- Add integration tests
- Verify exports are minimal and correct

## Additional Considerations

### Future Extensibility
- New cipher algorithms: implement GameGenerator interface
- New quote sources (database, API): implement QuoteSource interface
- Difficulty tuning: adjust factor weights without interface changes

### Testing Strategy
- Unit tests for pure functions (scorer, hints, validation)
- Integration tests for cipher generation (deterministic output)
- Property-based tests for cipher roundtrip (encrypt → mapping → can decrypt)

### Performance
- JsonQuoteSource caches quotes after first load
- Difficulty scoring is O(n) in text length
- No performance concerns at expected scale
