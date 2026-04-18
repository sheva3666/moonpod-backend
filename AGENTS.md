# Agents.md — Backend

> You are an AI agent working in a Node.js backend codebase. Follow every rule in this file. When a rule conflicts with your general training, this file wins.

---

## Stack

- Node.js 20+, ESM modules
- TypeScript 5+ with `strict: true`
- Apollo Server 4, GraphQL
- Prisma 5+ ORM
- PostgreSQL 15+
- Zod for runtime validation
- Jest + Supertest for testing

---

## 1. General Behavior

- **Read before writing.** Before modifying any file, read it and its neighboring files. Match the patterns already in use.
- **No unrelated changes.** If you spot a bug or improvement outside the current task, flag it in a comment — do not fix it in the same changeset.
- **Run checks after every change.** Execute `tsc --noEmit`, `npx prisma validate`, and relevant tests. Fix all errors before presenting results.
- **Types first.** When implementing anything new, define the types before writing logic. This catches design issues early.
- **Never generate dead code.** Every function, type, and import must be used. No "might be useful later" code.
- **No placeholder logic.** Never write `// TODO: implement` and move on. Either implement it or explicitly tell the developer it's unfinished and why.
- **Explain trade-offs.** When a decision has trade-offs, state both sides and justify the choice.
- **Ask, don't assume.** If the task is ambiguous about architecture decisions, ask rather than guessing.

---

## 2. TypeScript Rules

### Hard Bans

Never write any of the following. There are zero exceptions:

```typescript
// ❌ BANNED
(value as any)(value as unknown as SomeType); // double cast — fix the type instead
// @ts-ignore
// @ts-expect-error               // allowed ONLY with a linked issue ticket
value!; // non-null assertion — narrow the type instead
```

### Preferences

- Use **`type`** for everything. Use `interface` only when declaration merging is intentionally needed.
- Use **`as const` objects** instead of `enum`. Enums are banned:

```typescript
// ✅
const Role = {
  Admin: "ADMIN",
  User: "USER",
  Moderator: "MODERATOR",
} as const;
type Role = (typeof Role)[keyof typeof Role];

// ❌
enum Role {
  Admin = "ADMIN",
  User = "USER",
}
```

- Use **discriminated unions** for "one-of-N" states. Never model state with parallel booleans:

```typescript
// ✅
type Result<T> = { ok: true; value: T } | { ok: false; error: AppError };

// ❌
type Result<T> = { success: boolean; data?: T; error?: Error };
```

- Always constrain generics. Unconstrained `<T>` is a code smell.
- Prefer `unknown` over `any` in catch blocks. Narrow with type guards.
- Use `satisfies` for type-checked constants that should keep their literal type:

```typescript
const config = {
  port: 4000,
  host: "localhost",
} satisfies ServerConfig;
```

- Derive types from Zod schemas (`z.infer<>`) and Prisma models. Never duplicate a type that can be derived.

---

## 3. Prisma Rules

### Schema

- Every model **must** have `createdAt` and `updatedAt` timestamp fields.
- Use `@map("snake_case")` and `@@map("table_name")` so PostgreSQL uses snake_case while Prisma uses camelCase.
- Always set `onDelete` explicitly on every relation. No implicit behavior.
- Every foreign key column gets an `@@index`.
- Use `cuid()` or `uuid()` for IDs. Never auto-increment integers as external-facing IDs.
- Use Prisma enums for values that map to a GraphQL enum.

### Queries

- **Select only what you need.** Always use `select` or `include` — never fetch a full model with all relations unless every field is needed.
- **Paginate every list query.** No unbounded `findMany`. Always pass `take` with a hard maximum (e.g., 100).
- Use `findFirst` when you need one record. Never `findMany()[0]`.
- **Batch reads** with `where: { id: { in: ids } }` instead of looping `findUnique`.
- Use `prisma.$transaction()` for multi-write operations. Always set `timeout` and `maxWait`.
- Use `prisma.$queryRaw` only as a last resort (CTEs, window functions). Always parameterize with `Prisma.sql` — never string interpolation.
- Never import `prisma` directly in resolvers or services. It is only used inside repository files.

### Migrations

- Name migrations descriptively: `add_user_role_column`, not `migration` or `update`.
- Never manually edit generated migration SQL.
- If you need to seed data, write a separate seed script — never embed data logic in schema migrations.

---

## 4. GraphQL & Apollo Server Rules

### Schema Design

- **Wrap inputs:** Every mutation takes a single `input` argument: `createUser(input: CreateUserInput!)`, never loose arguments.
- **Return payload types** from mutations, not raw entities:

```graphql
type CreateUserPayload {
  user: User
  errors: [MutationError!]!
}
```

- Use **Relay-style cursor pagination** (`Connection`, `Edge`, `PageInfo`). No offset pagination in the public API.
- Use custom scalars (`DateTime`, `EmailAddress`) — never raw `String` for typed values.
- Fields are **nullable by default**. Only add `!` when the value is guaranteed in every possible state.
- Use `ID` scalar for identifiers, never `String`.

### Resolvers

Resolvers are **thin dispatchers**. They extract arguments, call a service method, and return the result. Rules:

- **Zero business logic in resolvers.** No validation, no authorization checks, no conditional branching beyond formatting the response.
- Every resolver receives and passes along the typed `context`.
- Every resolver that fetches related data inside a list **must** use a DataLoader. No exceptions — this prevents N+1 queries.
- When writing a new resolver, always check: does a DataLoader for this relation already exist? If yes, use it. If not, create one.

### DataLoaders

- Create DataLoaders **per request** in the context factory. Never share a DataLoader instance across requests.
- The batch function must return results **in the same order** as the input IDs.
- Use a `Map` to preserve order, and fill missing entries with `null` or `[]`.

### Context

- Authentication happens **once** in the context factory — never inside individual resolvers.
- The context type must be explicitly defined and shared across all resolvers. Never use `any` for context.
- Include `requestId` in every context for log traceability.

---

## 5. Service Layer Rules

Services contain **all** business logic. When writing or modifying a service method, follow this exact order:

1. **Authorize** — check permissions first, before any DB call.
2. **Validate** — parse input through the Zod schema. Reject invalid input before touching the database.
3. **Check business rules** — uniqueness, existence, state preconditions.
4. **Execute** — call repository methods.
5. **Side effects** — emit events, send notifications, write audit logs. Always after the main operation succeeds.

Additional rules:

- Every public service method accepts `context` as its last parameter.
- Services return `Result<T>` for operations that can fail with domain errors. They only throw for truly unexpected bugs.
- Services call repositories, never `prisma` directly.
- Cross-module calls go **service → service**, never **repository → repository**.

---

## 6. Validation Rules

- Write a **Zod schema for every GraphQL input type**. GraphQL checks shapes, not business constraints.
- Sanitize inside schemas: `.trim()`, `.toLowerCase()` for emails, `.max()` for all strings.
- Derive TypeScript input types from Zod: `type CreateUserInput = z.infer<typeof createUserSchema>`. Never hand-write a type that a schema already describes.
- Validate at the **service boundary** — the first thing a service does after authorization.
- Reuse shared schema fragments for common patterns: pagination args, ID validation, date ranges.

---

## 7. Error Handling Rules

### Error Structure

- All domain errors extend a base `AppError` class with `code`, `statusCode`, and `isOperational` properties.
- Create specific error subclasses per domain: `UserNotFoundError`, `EmailAlreadyExistsError`, `InsufficientCreditsError`.
- **Operational errors** (validation, not found, unauthorized) are safe to surface to the client via the mutation payload `errors` field.
- **Programmer errors** (null reference, missing env var) must crash the process — let the process manager restart.

### In Resolvers

- Map `AppError` to GraphQL-safe responses in Apollo's `formatError`. This is the **only** exit point for errors.
- Never expose stack traces, internal messages, or DB error details in production.
- Log every error with its `requestId` for traceability.

### In Services

- Return `Result<T>` for expected failures. Never use `throw` for business logic errors.
- Use `try/catch` only around infrastructure calls (DB, external APIs) — catch, wrap in `AppError`, and return as `Result`.

### In General

- Never write empty catch blocks. Every catch must either handle, rethrow, or log.
- Never swallow errors with `catch (e) { return null }`.
- Use `unknown` in catch blocks, then narrow:

```typescript
catch (error: unknown) {
  if (error instanceof Prisma.PrismaClientKnownRequestError) { ... }
  throw error; // rethrow if unrecognized
}
```

---

## 8. Security Rules

- **Never trust client input.** Validate and sanitize everything at the service boundary via Zod.
- **Never interpolate values into raw SQL.** Always use `Prisma.sql` parameterized queries.
- **Never log sensitive data:** passwords, tokens, credit card numbers, PII.
- **Never commit secrets.** Use environment variables. Verify `.env` is in `.gitignore`.
- Hash passwords with `bcrypt` or `argon2`. Never store plaintext.
- Rate-limit sensitive mutations (login, registration, password reset) at the Apollo plugin or middleware level.
- Apply **depth limiting** and **query complexity analysis** to prevent abuse via deeply nested GraphQL queries.
- Always validate file uploads (type, size, extension) before processing.

---

## 9. Testing Rules

### What To Test

| Always test                                   | Never test                                          |
| --------------------------------------------- | --------------------------------------------------- |
| Service layer business logic                  | Prisma query syntax                                 |
| Resolver integration (query → response shape) | Internal private helper functions in isolation      |
| Error cases and edge cases                    | Apollo Server internals                             |
| Authorization (who can do what)               | TypeScript type correctness (compiler handles this) |
| Validation schemas (valid + invalid inputs)   | Exact log output                                    |

### How To Test

- **Unit tests** for services: mock the repository, test business logic in isolation.
- **Integration tests** for resolvers: use a real test database, seed data, send GraphQL operations via Supertest.
- Use **factory functions** to build test data. Never hardcode test objects inline:

```typescript
// ✅
const user = buildUser({ role: 'ADMIN' });

// ❌
const user = { id: '1', name: 'Test', email: 'test@test.com', role: 'ADMIN', createdAt: ... };
```

- Every test file lives next to the code it tests: `user.service.ts` → `user.service.test.ts`.
- Tests must be independent. Never depend on execution order or shared mutable state.
- Reset the test database between test suites, not between individual tests (use transactions for per-test isolation when possible).
- Name tests by behavior: `it('returns FORBIDDEN when a non-admin tries to delete a user')`.

---

## 10. Code Style & Naming

| Entity                 | Convention        | Example                                 |
| ---------------------- | ----------------- | --------------------------------------- |
| File                   | `kebab-case.role` | `user.service.ts`, `user.repository.ts` |
| Function               | camelCase         | `findUserById`                          |
| Type / Type alias      | PascalCase        | `CreateUserInput`                       |
| Constant               | UPPER_SNAKE_CASE  | `MAX_PAGE_SIZE`                         |
| GraphQL type           | PascalCase        | `UserConnection`                        |
| GraphQL field          | camelCase         | `createdAt`                             |
| GraphQL enum value     | UPPER_SNAKE_CASE  | `ADMIN`                                 |
| DB table (via `@@map`) | snake_case plural | `users`                                 |
| DB column (via `@map`) | snake_case        | `created_at`                            |
| Env variable           | UPPER_SNAKE_CASE  | `DATABASE_URL`                          |

### Import Order

Enforce via ESLint. Follow this sequence:

```typescript
// 1. Node built-ins
import { randomUUID } from "node:crypto";

// 2. Third-party
import { ApolloServer } from "@apollo/server";
import { z } from "zod";

// 3. Internal — absolute (aliases)
import { logger } from "@/infrastructure/logger";
import { AppError } from "@/shared/errors";

// 4. Relative — parent
import { userRepository } from "./user.repository";

// 5. Relative — sibling types (type-only imports last)
import type { CreateUserInput } from "./user.types";
```

### General

- **Named exports only.** No default exports — they break refactoring and discoverability.
- No magic numbers or strings. Extract to named constants.
- No nested ternaries. Use early returns, `if/else`, or lookup objects.
- `null` means intentional absence. `undefined` means not provided. Don't mix them arbitrarily.
- No `console.log`. Use the project's structured logger with appropriate levels (`debug`, `info`, `warn`, `error`).

---

## 11. Layer Dependency Rules

These are hard constraints on what may import what:

| Layer            | May import from                                  | Never imports from         |
| ---------------- | ------------------------------------------------ | -------------------------- |
| **Resolvers**    | Services, shared types, shared errors            | Prisma, repositories       |
| **Services**     | Repositories, validators, other services, shared | Prisma directly, resolvers |
| **Repositories** | Prisma client singleton, shared types            | Services, resolvers        |
| **Validators**   | Zod, shared constants                            | Anything else              |
| **Shared**       | Node built-ins, third-party libs                 | Any module in `/modules`   |

- The Prisma client is instantiated **once** as a singleton and imported only by repository files.
- Cross-module calls flow **service → service**, never repository → repository.

---

## 12. Performance Rules

- Every list query is **paginated** with a hard max (100 items). No unbounded lists.
- Every relation resolved inside a list uses a **DataLoader**.
- Use `select` / `include` to fetch only needed fields. No "SELECT \*" equivalents.
- Add database indexes for every column used in `WHERE`, `ORDER BY`, or `JOIN`. Verify with `EXPLAIN ANALYZE` when in doubt.
- Cache expensive, rarely-changing queries (config, feature flags) at the service level with a TTL.
- Set query timeout at the Prisma and PostgreSQL level to prevent long-running queries from blocking the connection pool.
- Tune connection pool size for expected concurrency. Default Prisma pool is often too small for production.

---

## 13. Git & PR Rules

- Use **Conventional Commits**: `feat(user):`, `fix(auth):`, `refactor(order):`, `test(payment):`, `chore(deps):`.
- One concern per commit. One concern per PR.
- PR title matches the conventional commit format.
- PR description explains **what** changed and **why**, never just **how**.
- All CI checks (lint, typecheck, test, `prisma validate`) must pass before merge.

---

## 14. Environment & Configuration

- All configuration comes from environment variables. Never hardcode connection strings, secrets, or feature flags.
- Use a Zod schema at startup to parse and validate all env vars. Crash immediately on missing or invalid config:

```typescript
const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  PORT: z.coerce.number().default(4000),
  JWT_SECRET: z.string().min(32),
  NODE_ENV: z.enum(["development", "production", "test"]),
});

export const env = envSchema.parse(process.env);
```

- Never use `process.env` directly outside the config module. Always import the validated `env` object.
- Maintain `.env.example` with all required variables (no real secrets) committed to the repository.
