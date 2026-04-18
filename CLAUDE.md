# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # start with tsx watch (http://localhost:4000/graphql)
npm run build        # compile TypeScript to dist/
npm run start        # production start (requires build first)
npm run typecheck    # run tsc --noEmit without emitting files
npm run db:migrate   # apply pending Prisma migrations
npm run db:generate  # regenerate Prisma client after schema changes
npm run db:studio    # open Prisma Studio (DB GUI)
npm run db:reset     # wipe database and re-run all migrations
```

After any change to `prisma/schema.prisma`, always run `db:migrate` followed by `db:generate`.

## Architecture

### Entry Point

`src/index.ts` — wires Express + Apollo Server. Single GraphQL endpoint at `/graphql`. Context is created per-request in `src/context.ts`.

### Config

`src/config/env.ts` — Zod-validated env schema. All modules import `env` from here; never use `process.env` directly elsewhere. Crashes on startup if required vars are missing.

### Shared Types

`src/types.ts` — shared TypeScript types (`UserWithCompany`, `AuthPayloadResult`) derived from Prisma models.

### GraphQL Schema & Resolvers

- **Type definitions**: `src/schema/typeDefs.ts` — single file with all types, queries, and mutations
- **Resolvers**: `src/schema/resolvers/` — split by domain (`auth.ts`, `magicLink.ts`, `user.ts`), merged in `index.ts`
- To add a new operation: add the type definition to `typeDefs.ts`, create or update the resolver file, then export it from `index.ts`

### Auth Context

`src/context.ts` runs on every request. It extracts `userId` from the `Authorization: Bearer <token>` header (verified via `src/auth/jwt.ts`) and injects both `userId` and `prisma` into the GraphQL context. If the token is missing or invalid `userId` is `null`. The `AppContext` type is defined here and shared across all resolvers.

### JWT

`src/auth/jwt.ts` — access token (15 min) and refresh token (7 days). Tokens are signed/verified using secrets from `env`. Also exports `getRefreshTokenExpiry()` used by all auth resolvers. Refresh tokens are stored in the `RefreshToken` table and rotated on every use (old record deleted, new one created).

### Magic Link

`src/schema/resolvers/magicLink.ts`:
- `sendMagicLink` — invalidates existing unused tokens for the user, generates a 64-char `crypto.randomBytes` hex token, stores it in `MagicLinkToken` (15 min TTL), sends email. Always returns `true` regardless of whether the email exists (security).
- `verifyMagicLink` — validates token (not used, not expired), marks it used, returns `AuthPayload` identical to regular login.

### Email Service

`src/services/email.ts` — nodemailer wrapper. When `SMTP_HOST` is not set it logs the email to the console instead of sending (dev mode).

### Required `.env` Variables

```
DATABASE_URL
JWT_ACCESS_SECRET
JWT_REFRESH_SECRET
JWT_ACCESS_EXPIRES_IN   # e.g. 15m
JWT_REFRESH_EXPIRES_IN  # e.g. 7d
APP_URL                 # e.g. http://localhost:5173  (used to build magic link URLs)
```

Optional SMTP vars for real email: `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`. Omit all to use the console fallback.
