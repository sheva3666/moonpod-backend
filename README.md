# Moonpod Backend

A GraphQL API server for team/workforce management: authentication, team member
records, and role-based permissions, scoped per company.

## Tech stack

| Layer      | Technology                                                                                                             |
| ---------- | ---------------------------------------------------------------------------------------------------------------------- |
| Language   | TypeScript (strict mode, ESM/`NodeNext`)                                                                               |
| API        | [Apollo Server 5](https://www.apollographql.com/) over [Express 5](https://expressjs.com/), single `/graphql` endpoint |
| Database   | PostgreSQL via [Prisma ORM](https://www.prisma.io/)                                                                    |
| Auth       | JWT access/refresh tokens, bcrypt password hashing                                                                     |
| Validation | [Zod](https://zod.dev/)                                                                                                |
| Email      | Nodemailer (console fallback in dev)                                                                                   |
| Unit tests | [Jest](https://jestjs.io/) + `ts-jest`                                                                                 |
| E2E tests  | Jest + [Supertest](https://github.com/ladjs/supertest) against a real Postgres instance                                |
| CI         | GitHub Actions (separate unit and e2e workflows)                                                                       |

## Features

- **Auth** — register, login, refresh token rotation, logout
- **Magic link login** — passwordless sign-in via emailed one-time token
- **Password reset** — emailed reset token flow
- **Team members** — create/update/delete/list company team members, paginated and searchable, with sensitive fields (pay, notes, documents, prompts, next of kin) restricted to the member themselves or privileged roles
- **Roles** — company-scoped custom roles with permissions

All data is scoped per company — a user can only see and manage records belonging to their own company.

## Prerequisites

- Node.js 22+
- A running PostgreSQL instance (locally, via Docker, or hosted)

## Getting started

1. **Install dependencies**

   ```bash
   npm install
   ```

2. **Configure environment variables**

   Copy the variables below into a `.env` file at the project root:

   ```bash
   DATABASE_URL=
   JWT_ACCESS_SECRET=
   JWT_REFRESH_SECRET=
   JWT_ACCESS_EXPIRES_IN=
   JWT_REFRESH_EXPIRES_IN=
   APP_URL=
   ```

   See [Environment variables](#environment-variables) below for the full list, including optional ones (SMTP, CORS, port).

3. **Apply database migrations**

   ```bash
   npm run db:migrate
   npm run db:generate
   ```

4. **Start the dev server**

   ```bash
   npm run dev
   ```

   The GraphQL endpoint is available at `http://localhost:4000/graphql`.

## Available scripts

| Script                | Description                                                                |
| --------------------- | -------------------------------------------------------------------------- |
| `npm run dev`         | Start the server with `tsx watch` (auto-restart on change)                 |
| `npm run build`       | Compile TypeScript to `dist/`                                              |
| `npm run start`       | Run the compiled server (requires `build` first)                           |
| `npm run typecheck`   | Type-check without emitting files                                          |
| `npm run db:migrate`  | Apply pending Prisma migrations                                            |
| `npm run db:generate` | Regenerate the Prisma client after schema changes                          |
| `npm run db:studio`   | Open Prisma Studio (DB GUI)                                                |
| `npm run db:reset`    | Wipe the database and re-run all migrations                                |
| `npm run test`        | Run unit tests (Jest, no database required)                                |
| `npm run test:e2e`    | Run end-to-end tests (Jest + Supertest, requires a real Postgres database) |

After any change to `prisma/schema.prisma`, always run `db:migrate` followed by `db:generate`.

## Testing

There are two independent test suites, run with separate Jest configs and separate CI workflows.

### Unit tests

```bash
npm run test
```

Pure logic only (e.g. Zod schemas, query-building helpers) — no database, no network, runs in under a second. Lives in `tests/unit/`.

### End-to-end tests

```bash
npm run test:e2e
```

Boots the real Express + Apollo app (`src/app.ts`) in-process and drives it over HTTP with Supertest, hitting a real Postgres database. Lives in `tests/e2e/`.

**These tests will use whatever `DATABASE_URL` is in your environment when you run them — do not point this at a database with data you care about.** To run them locally against a disposable database:

```bash
# 1. Create a separate database (only needs to be done once)
createdb moonpod_test   # or: docker exec <container> psql -U <user> -c "CREATE DATABASE moonpod_test;"

# 2. Point the environment at it and apply migrations
DATABASE_URL="" \
JWT_ACCESS_SECRET=test-access-secret \
JWT_REFRESH_SECRET=test-refresh-secret \
npx prisma migrate deploy

# 3. Run the e2e suite with the same environment
DATABASE_URL="" \
JWT_ACCESS_SECRET=test-access-secret \
JWT_REFRESH_SECRET=test-refresh-secret \
npm run test:e2e
```

In CI, this database is a throwaway `postgres:16` service container that exists only for the duration of the job — see [CI](#ci) below.

## CI

Two GitHub Actions workflows run on every push to `main` and on every pull request:

- **`.github/workflows/unit-tests.yml`** — installs dependencies, generates the Prisma client, runs `npm run test`. No database involved.
- **`.github/workflows/e2e-tests.yml`** — spins up a `postgres:16` service container, runs `prisma migrate deploy` against it, then runs `npm run test:e2e`. Configuration (`DATABASE_URL`, JWT secrets, etc.) is pulled from repository secrets rather than hardcoded in the workflow.

## Environment variables

Required:

| Variable                 | Description                                                |
| ------------------------ | ---------------------------------------------------------- |
| `DATABASE_URL`           | PostgreSQL connection string                               |
| `JWT_ACCESS_SECRET`      | Signing secret for access tokens                           |
| `JWT_REFRESH_SECRET`     | Signing secret for refresh tokens                          |
| `JWT_ACCESS_EXPIRES_IN`  | Access token lifetime (e.g. `15m`)                         |
| `JWT_REFRESH_EXPIRES_IN` | Refresh token lifetime (e.g. `7d`)                         |
| `APP_URL`                | Base URL used to build magic-link and password-reset links |

Optional:

| Variable          | Description                                                                                                     |
| ----------------- | --------------------------------------------------------------------------------------------------------------- |
| `SMTP_HOST`       | SMTP server host — omit this (and the other `SMTP_*` vars) to log emails to the console instead of sending them |
| `SMTP_PORT`       | SMTP server port                                                                                                |
| `SMTP_SECURE`     | `true`/`false` — use TLS                                                                                        |
| `SMTP_USER`       | SMTP username                                                                                                   |
| `SMTP_PASS`       | SMTP password                                                                                                   |
| `SMTP_FROM`       | "From" address for outgoing email                                                                               |
| `ALLOWED_ORIGINS` | Comma-separated CORS origins (production only; defaults to `*` in dev)                                          |
| `PORT`            | Server port (default `4000`)                                                                                    |
| `NODE_ENV`        | `development` (default), `production`, or `test` — controls Prisma query logging                                |

Validated at startup via a Zod schema in `src/config/env.ts` — the process crashes immediately if a required variable is missing.

## Project structure

```
src/
  index.ts              # process entry point: starts the server, handles shutdown
  app.ts                # builds the Express + Apollo app (used by index.ts and by e2e tests)
  context.ts             # per-request GraphQL context (auth, prisma)
  config/env.ts          # Zod-validated environment config
  db.ts                  # singleton PrismaClient
  auth/jwt.ts             # access/refresh token signing and verification
  schema/                # GraphQL type definitions and resolvers
  services/               # business logic
  repositories/           # data access (Prisma queries)
  schemas/validation.ts   # Zod input validation schemas
tests/
  unit/                   # pure-logic Jest tests
  e2e/                     # Supertest-driven tests against a real database
```
