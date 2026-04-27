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

### Database Client

`src/db.ts` — singleton `PrismaClient`. Enables query logging in development (`NODE_ENV=development`). Import `prisma` from here; never instantiate `PrismaClient` elsewhere.

### Shared Types

`src/types.ts` — shared TypeScript types (`UserWithCompany`, `AuthPayloadResult`) derived from Prisma models.

### GraphQL Schema & Resolvers

- **Type definitions**: `src/schema/typeDefs.ts` — single file with all types, queries, and mutations
- **Resolvers**: `src/schema/resolvers/` — split into `mutations/` and `queries/` subdirectories, merged in `index.ts`
  - `mutations/auth.ts` — register, login, refreshToken, logout
  - `mutations/magicLink.ts` — sendMagicLink, verifyMagicLink
  - `mutations/passwordReset.ts` — requestPasswordReset, resetPassword
  - `mutations/teamMember.ts` — createTeamMember, updateTeamMember
  - `mutations/role.ts` — createRole, updateRole, deleteRole
  - `queries/user.ts` — me, users, teamMember, teamMembers, checkEmail
  - `queries/role.ts` — roles, role
- To add a new operation: add the type definition to `typeDefs.ts`, create or update the resolver file under the appropriate subdirectory, then export it from `index.ts`

### Service Layer

Business logic lives in `src/services/`. Resolvers delegate directly to services; services call repositories.

- `authService` — register, login, refreshToken, logout. Handles bcrypt hashing and token issuance.
- `userService` — getMe, getUsers, getTeamMember, getTeamMembers, createTeamMember, updateTeamMember. Enforces company scoping and authorization rules.
- `roleService` — getRoles, getRole, createRole, updateRole, deleteRole. All operations are company-scoped; enforces unique role names per company.
- `magicLinkService` — sendMagicLink, verifyMagicLink.
- `passwordResetService` — requestPasswordReset, resetPassword.
- `auditService` — fire-and-forget console JSON logger for security events (LOGIN_SUCCESS, LOGIN_FAILED, REGISTER, PASSWORD_RESET, REFRESH_TOKEN_REUSE_DETECTED). Does not write to the database.
- `email.ts` — nodemailer wrapper. Falls back to console logging when `SMTP_HOST` is not set (dev mode).

### Repository Layer

Data access lives in `src/repositories/`. Services call repositories; repositories call `prisma` directly.

- `authRepository` — CRUD for `RefreshToken`: create, find, delete (strict), revoke (silent), revokeAll, rotate (atomic transaction).
- `userRepository` — queries for `User`: findByEmail, findByEmailWithCompany, findCurrentUser, findByIdWithCompany, findManyByCompany, findMember (full profile), findMembersWithCount (paginated, atomic transaction), create, createMember, updateMember, updatePassword.
- `roleRepository` — CRUD for `Role`: findManyWithCount (paginated + total, atomic transaction), findByIdAndCompany, findByName (unique compound key), create, update, delete.
- `companyRepository` — create company.
- `magicLinkRepository` — CRUD for `MagicLinkToken`.
- `passwordResetRepository` — CRUD for `PasswordResetToken`.

### Auth Context

`src/context.ts` runs on every request. It extracts `userId` from the `Authorization: Bearer <token>` header (verified via `src/auth/jwt.ts`) and injects both `userId` and `prisma` into the GraphQL context. If the token is missing or invalid `userId` is `null`. The `AppContext` type is defined here and shared across all resolvers.

### JWT

`src/auth/jwt.ts` — access token (15 min) and refresh token (7 days). Tokens are signed/verified using secrets from `env`. Also exports `getRefreshTokenExpiry()` used by all auth resolvers. Refresh tokens are stored in the `RefreshToken` table and rotated on every use (old record deleted, new one created).

### Magic Link

`src/services/magicLinkService/`:
- `sendMagicLink` — rate-limited (1 per minute per user); invalidates existing unused tokens, generates a 64-char `crypto.randomBytes` hex token, stores it in `MagicLinkToken` (15 min TTL), sends email. Always returns `true` regardless of whether the email exists (security).
- `verifyMagicLink` — validates token (not used, not expired), marks it used, returns `AuthPayload` identical to regular login.

### Password Reset

`src/services/passwordResetService/`:
- `requestPasswordReset` — invalidates existing tokens, generates a 32-byte hex token, stores in `PasswordResetToken` (15 min TTL), sends email. Always returns `true` (security).
- `resetPassword` — validates token (not used, not expired), hashes new password with bcrypt, updates user, marks token used (atomic via `performReset`).

### Authorization Model

- All mutations/queries require `userId` in context (from JWT); unauthenticated requests throw `UNAUTHENTICATED`.
- All user data is scoped to `companyId` — users can only see/modify members of their own company.
- Sensitive fields (`pay`, `notes`, `documents`, `prompts`, `nextOfKin`) are stripped from `getTeamMember` responses unless the requester is the member themselves or has a privileged role.
- Privileged roles: `OWNER`, `MANAGER`, `ADMIN`. Only these roles can create team members.
- `createTeamMember` generates a random temporary password; new members log in via magic link.

### Validation

`src/schemas/validation.ts` — Zod schemas used by services before hitting the database:
- `passwordSchema` — min 8, max 128 chars
- `pinSchema` — 4–6 digits
- `registerSchema` — full registration input

### Required `.env` Variables

```
DATABASE_URL
JWT_ACCESS_SECRET
JWT_REFRESH_SECRET
JWT_ACCESS_EXPIRES_IN   # e.g. 15m
JWT_REFRESH_EXPIRES_IN  # e.g. 7d
APP_URL                 # e.g. http://localhost:5173  (used to build magic link and password reset URLs)
```

Optional vars:
- SMTP: `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` — omit all to use the console fallback.
- `ALLOWED_ORIGINS` — comma-separated CORS origins; omit to use defaults.
- `PORT` — defaults to 4000.
- `NODE_ENV` — `development` (default), `production`, or `test`. Controls Prisma query logging.
