# Game Endpoints Design

## Summary

This design implements three REST endpoints that enable clients to retrieve cryptoquip puzzles and validate solutions. The core approach treats puzzles as deterministic, date-based artifacts: requesting a puzzle for any given date always produces the same encryption using the existing `gameGenerator` service. To support intuitive client workflows, the API uses dates for retrieval (GET /game/today, GET /game/:date) but opaque game IDs for validation (POST /game/:id/check). These IDs are encoded using Sqids, a URL-safe encoding library that reversibly transforms dates into short strings.

The implementation follows the concentric pattern established in the existing codebase: domain-based route organization under `src/domain/game/routes/`, with separate Fastify plugins for puzzle retrieval and solution checking. No puzzle storage is required — the API regenerates puzzles on demand by calling `gameGenerator.generateDailyPuzzle(date)` and decoding game IDs back to their original dates. This stateless design keeps the implementation simple while future-proofing the game ID format to eventually encode user context (e.g., user ID + date) when authentication is added.

## Definition of Done

Three REST endpoints for the Unquote API:

1. **GET /game/today** - Retrieve today's cryptoquip puzzle
   - No parameters needed
   - Returns: game ID, encrypted text, hints, author, difficulty, date

2. **GET /game/:date** - Retrieve a specific date's puzzle
   - Date parameter in ISO format (e.g., `2026-02-01`)
   - Returns: game ID, encrypted text, hints, author, difficulty, date

3. **POST /game/:id/check** - Validate a solution attempt
   - Game ID from the GET response (opaque string)
   - Accepts: the user's decoded text
   - Returns: boolean correct/incorrect

4. **ID encoding utilities** (internal) - Functions to convert between dates and opaque game IDs
   - Used internally by API, not exposed to clients
   - Future-proofed: could encode user ID + date later

**Success criteria:**
- Clients use dates for GET, IDs for POST (intuitive UX)
- Same date always returns same puzzle (and same game ID, for now)
- Game ID is URL-safe and opaque
- Future: Game ID could encode user context without API changes

**Explicitly out of scope:**
- User accounts and authentication
- Attempt tracking or statistics
- Partial progress or letter-by-letter feedback

## Glossary

- **Cryptoquip**: A type of word puzzle where a quotation is encrypted using a simple substitution cipher; players decode the quote by determining which encrypted letter maps to which plaintext letter.
- **Sqids**: A library for generating short, URL-safe, reversible IDs from numbers; used here to encode dates into opaque game identifiers.
- **Concentric pattern**: The architectural approach used in the referenced codebase where routes are organized by domain, with aggregator plugins registering child plugins hierarchically.
- **TypeBox**: A JSON Schema Type Builder with static type inference for TypeScript; used with Fastify to define request/response schemas that generate both runtime validation and compile-time types.
- **FastifyPluginAsyncTypebox**: A Fastify plugin type that integrates with the TypeBox type provider, enabling type-safe route definitions.
- **Deterministic**: A property where the same input always produces the same output; critical here because requesting a puzzle for the same date must always return identical encrypted text and hints.
- **Opaque ID**: An identifier whose internal structure is hidden from clients; here, game IDs are opaque strings that clients use for validation without knowing they encode dates.
- **Singleton container**: An Awilix dependency injection container scope where services are instantiated once and reused across all requests; `gameGenerator` and `quoteSource` live here.
- **Cipher mapping**: The internal substitution table showing which plaintext letter maps to which encrypted letter; intentionally omitted from API responses to avoid spoiling the puzzle.

## Architecture

REST endpoints following the concentric pattern with domain-based route organization. Routes access existing DI services (`gameGenerator`, `quoteSource`) to generate puzzles and validate solutions.

**Route structure:**
```
src/domain/game/
├── routes/
│   ├── index.ts       # Aggregator: registers puzzle and solution routes
│   ├── puzzle.ts      # GET /today, GET /:date
│   └── solution.ts    # POST /:id/check
└── game-id.ts         # Sqids encode/decode utilities
```

**Data flow - GET /game/today (or /:date):**
1. Parse date (today or from path parameter)
2. Call `gameGenerator.generateDailyPuzzle(date)` (deterministic by date)
3. Encode date into opaque game ID using Sqids
4. Transform response: normalize hints to uppercase, omit cipher mapping
5. Return puzzle with ID for use in solution checking

**Data flow - POST /game/:id/check:**
1. Decode game ID to extract date (return 404 if invalid)
2. Regenerate puzzle from date (no storage needed)
3. Fetch original quote via `quoteSource.getQuote(puzzle.quoteId)`
4. Validate solution using existing `validateSolution()` function
5. Return `{ correct: boolean }`

**Key design decisions:**
- No puzzle storage: puzzles regenerated from date on demand
- Sqids for ID encoding: opaque, URL-safe, reversible, deterministic
- Hints normalized to uppercase in API layer (game-generator produces mixed case)
- Wrong answers return 200 with `correct: false` (not an error)

## Existing Patterns

Investigation found route patterns in the concentric codebase (https://github.com/ed3dnet/concentric):

- **Multiple plugins per domain**: Each route file exports a separate Fastify plugin
- **Domain aggregator**: `index.ts` registers all plugins for a domain
- **Hierarchical prefixes**: `/api` → `/game` → individual routes
- **Inline schemas**: TypeBox schemas defined inline for single-use, separate file for shared
- **Plugin type**: `FastifyPluginAsyncTypebox` with TypeBox type provider

This design follows these patterns exactly:
- `puzzle.ts` and `solution.ts` are separate plugins
- `index.ts` aggregates them under `/game` prefix
- TypeBox schemas inline in route files

**DI access pattern** from existing API code:
- Routes access `request.deps.gameGenerator` and `request.deps.quoteSource`
- These are already registered in the singleton container

## API Contracts

**GET /game/today and GET /game/:date Response:**

```typescript
const PuzzleResponseSchema = Type.Object({
  id: Type.String({ description: "Opaque game ID for solution checking" }),
  date: Type.String({ format: "date", description: "ISO date (YYYY-MM-DD)" }),
  encryptedText: Type.String({ description: "Encrypted quote text" }),
  author: Type.String({ description: "Quote author" }),
  difficulty: Type.Number({ minimum: 0, maximum: 100 }),
  hints: Type.Array(Type.Object({
    cipherLetter: Type.String({ minLength: 1, maxLength: 1 }),
    plainLetter: Type.String({ minLength: 1, maxLength: 1 }),
  })),
});
```

**POST /game/:id/check Request/Response:**

```typescript
const CheckRequestSchema = Type.Object({
  solution: Type.String({ minLength: 1, description: "User's decoded text" }),
});

const CheckResponseSchema = Type.Object({
  correct: Type.Boolean(),
});
```

**Error responses:**
- `400`: Invalid date format or malformed request body
- `404`: Invalid game ID (cannot decode)

## Implementation Phases

<!-- START_PHASE_1 -->
### Phase 1: Dependencies and Game ID Utilities

**Goal:** Add Sqids dependency and implement ID encoding/decoding functions

**Components:**
- `sqids` package added to `api/packages/api/package.json`
- `src/domain/game/game-id.ts` — `encodeGameId(date)` and `decodeGameId(id)` functions
- Unit tests for game-id functions including property-based roundtrip tests

**Dependencies:** None

**Done when:** `pnpm install` succeeds, game-id functions encode/decode correctly, all tests pass
<!-- END_PHASE_1 -->

<!-- START_PHASE_2 -->
### Phase 2: Route Infrastructure

**Goal:** Set up route plugin structure following concentric pattern

**Components:**
- `src/domain/game/routes/index.ts` — aggregator plugin that registers child routes
- `src/domain/game/routes/puzzle.ts` — empty plugin skeleton
- `src/domain/game/routes/solution.ts` — empty plugin skeleton
- Registration in `src/index.ts` with `/game` prefix

**Dependencies:** Phase 1

**Done when:** Server starts, `/game` prefix registered, OpenAPI shows empty game routes
<!-- END_PHASE_2 -->

<!-- START_PHASE_3 -->
### Phase 3: GET /game/today Endpoint

**Goal:** Retrieve today's cryptoquip puzzle

**Components:**
- Route handler in `puzzle.ts` for `GET /today`
- TypeBox schema for puzzle response
- Hint normalization to uppercase
- Unit tests with mocked gameGenerator

**Dependencies:** Phase 2

**Done when:** GET /game/today returns valid puzzle, hints are uppercase, mapping not exposed, tests pass
<!-- END_PHASE_3 -->

<!-- START_PHASE_4 -->
### Phase 4: GET /game/:date Endpoint

**Goal:** Retrieve puzzle for any date

**Components:**
- Route handler in `puzzle.ts` for `GET /:date`
- Date parsing and validation (ISO format)
- Error response for invalid date format
- Unit tests for valid dates, invalid formats

**Dependencies:** Phase 3

**Done when:** GET /game/:date returns puzzle for valid dates, 400 for invalid formats, tests pass
<!-- END_PHASE_4 -->

<!-- START_PHASE_5 -->
### Phase 5: POST /game/:id/check Endpoint

**Goal:** Validate solution attempts

**Components:**
- Route handler in `solution.ts` for `POST /:id/check`
- TypeBox schemas for request body and response
- Game ID decoding with 404 for invalid IDs
- Solution validation using existing `validateSolution()` function
- Unit tests for correct/incorrect solutions, invalid IDs

**Dependencies:** Phase 4

**Done when:** POST returns correct/incorrect, invalid IDs return 404, tests pass
<!-- END_PHASE_5 -->

<!-- START_PHASE_6 -->
### Phase 6: Integration Tests

**Goal:** Verify full request flow through Fastify

**Components:**
- `src/domain/game/routes/puzzle.test.integration.ts`
- `src/domain/game/routes/solution.test.integration.ts`
- Tests using real DI container with test quotes
- OpenAPI schema validation

**Dependencies:** Phase 5

**Done when:** Integration tests pass, OpenAPI documentation accurate
<!-- END_PHASE_6 -->

## Additional Considerations

### Session Model Evolution

When user accounts are added, game sessions will be looked up by `(date, userId)` tuple rather than encoding userId into the game ID. This keeps the game ID format stable (always just encoded date) while allowing user-specific state.

**Current (anonymous):**
- GET returns puzzle with ID = encoded date
- POST validates solution, returns correct/incorrect
- No state stored

**Future (authenticated):**
- GET returns puzzle with ID = encoded date (unchanged)
- Server creates/fetches session by `(decode(id) → date, currentUser)`
- POST validates, records attempt to session, returns result
- GameService handles session lifecycle internally

The API contract stays identical. The game ID remains a puzzle identifier, not a session identifier.

### Route Registration Order

Register `/game/today` before `/game/:date` to prevent "today" from being captured as a date parameter. Fastify matches routes in registration order.

### Timezone Handling

`GET /game/today` uses UTC to determine the current date. The `date` field in the response clarifies which day's puzzle was returned, allowing clients to display appropriately for the user's timezone.

When user accounts exist, we can derive "today" from user's timezone preference without API changes.

### Quote Selection Stability

**Known limitation:** The current `selectFromArray` implementation uses `rng() * array.length` for selection. Adding or removing quotes changes the array length, which changes which quote is selected for every date.

**Fix (game-generator change, separate from this design):** Use rendezvous hashing instead of index-based selection. Score each quote as `hash(seed + quoteId)` and select the highest scorer. This makes selection stable: adding a quote only affects ~1/n of dates (where n = quote count).

This is outside the scope of the API endpoints design but should be addressed before quote database changes are common.

### Rate Limiting

Global rate limit (100 req/min) already configured. Per-user per-puzzle limits deferred until user accounts exist.

### Hint Casing

API normalizes hints to uppercase for consistency. The game-generator produces mixed case (uppercase cipher, lowercase plain) which the API transforms before response.
