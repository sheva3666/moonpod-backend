# Moonpod Backend - Architecture Review

**Date:** April 22, 2026  
**Project:** moonpod-backend  
**Stack:** Node.js + Express + Apollo GraphQL + Prisma + PostgreSQL  
**TypeScript Version:** 6.0.3  
**Review Scope:** Full codebase examination (src/, prisma/, config, package.json)

---

## Executive Summary

Moonpod Backend is a GraphQL API built on Apollo Server 5.5 with Prisma as the ORM. The application implements a multi-tenant employee management system with sophisticated authentication mechanisms (JWT, magic links, password resets), user team management, and extensive user profile data (skills, pay, documents, notes, appointments, etc.).

**Architecture Quality: GOOD (7/10)**
- Clean separation of concerns with service layer abstraction
- Strong type safety via TypeScript with strict mode enabled
- Proper use of Zod for environment validation
- Good token management with JWT and refresh token rotation
- Well-structured GraphQL resolvers

**Critical Issues:** 2  
**High Issues:** 5  
**Medium Issues:** 6  
**Low Issues:** 4

---

## Strengths

### 1. **Strong Type Safety**
- TypeScript strict mode enabled (`"strict": true` in tsconfig.json)
- Full type inference across services and resolvers
- Zod validation for environment variables (env.ts) ensures runtime safety
- Prisma provides strong typing for database operations
- Type-safe GraphQL context and resolver parameters

### 2. **Clean Service Layer Architecture**
- Service layer decoupled from GraphQL resolvers
- Clear separation: resolvers delegate to services
- Services handle business logic (authService, userService, magicLinkService, passwordResetService)
- Easy to test and maintain

### 3. **Security Consciousness**
- Passwords hashed with bcrypt (12 salt rounds) - appropriate cost factor
- PIN fields also hashed (not just password)
- Refresh tokens stored in database with expiration tracking
- Magic link and password reset tokens include expiration and "used" flag
- Bearer token extraction properly validated in context
- Secrets kept in environment variables (not hardcoded)
- Email existence checking doesn't leak information (returns true even if user not found)

### 4. **Proper Error Handling with GraphQL Errors**
- Uses GraphQL error extensions with appropriate codes (UNAUTHENTICATED, BAD_USER_INPUT, NOT_FOUND, UNAUTHENTICATED)
- Meaningful error messages
- Consistent error reporting pattern across services

### 5. **Environment Configuration Best Practices**
- Zod schema for validation with sensible defaults
- Support for both development and production modes
- Graceful handling of optional SMTP configuration
- Console fallback for email in development

### 6. **Database Transaction Usage**
- Uses Prisma transactions for atomic operations (e.g., passwordResetService line 59-70)
- Ensures data consistency during password reset and token invalidation

### 7. **Input Validation & Sanitization**
- User input validated via Zod in config
- Search and filter inputs properly sanitized using `.trim()`
- Filter builders use parameterized queries (Prisma prevents SQL injection)

### 8. **Pagination & Performance Awareness**
- Proper pagination implementation with page/pageSize
- Max page size limit (100) prevents resource exhaustion
- Uses Prisma transactions to fetch user count and users in single roundtrip
- Pagination includes bounds checking

---

## Issues by Severity

### CRITICAL

#### Issue C1: Password Reset Token Not Invalidated During Service Override
**File:** src/services/passwordResetService/index.ts (lines 42-73)  
**Description:** When a user resets their password, all existing refresh tokens are invalidated (line 69), but the code doesn't invalidate ALL active password reset tokens for the user. This means if an attacker obtains an old unused password reset token, they could still use it after the user has changed their password.

**Current Code:**
```typescript
// Only validates THIS token is not used
if (!record || record.used || record.expiresAt < new Date()) {
  throw new GraphQLError("Reset link is invalid or has expired", ...);
}
// But doesn't invalidate other unused tokens for the same user
await prisma.$transaction([
  prisma.passwordResetToken.update({
    where: { id: record.id },
    data: { used: true },
  }),
  prisma.user.update({
    where: { id: record.userId },
    data: { password: hashedPassword },
  }),
  prisma.refreshToken.deleteMany({ where: { userId: record.userId } }),
  // Missing: prisma.passwordResetToken.updateMany({ where: { userId: record.userId, used: false }, data: { used: true } })
]);
```

**Risk:** High privilege escalation - an attacker with an old reset link could regain access even after the legitimate user has changed their password.

**Recommended Fix:**
```typescript
await prisma.$transaction([
  prisma.passwordResetToken.update({
    where: { id: record.id },
    data: { used: true },
  }),
  prisma.user.update({
    where: { id: record.userId },
    data: { password: hashedPassword },
  }),
  // Invalidate all other unused reset tokens
  prisma.passwordResetToken.updateMany({
    where: { userId: record.userId, used: false },
    data: { used: true },
  }),
  // Revoke all sessions
  prisma.refreshToken.deleteMany({ where: { userId: record.userId } }),
]);
```

---

#### Issue C2: Missing Input Validation for Password Reset (No Minimum Length)
**File:** src/schema/typeDefs.ts (line 202)  
**Description:** The `resetPassword` mutation accepts `newPassword: String!` without any validation constraints. There is no minimum length, pattern enforcement, or validation of password strength.

**Current Code:**
```graphql
resetPassword(token: String!, newPassword: String!): Boolean!
```

**Risk:** Users could set trivially weak passwords like `"a"` or `"123"`. Combined with the password field storing hashed values and no password history, this could significantly reduce security.

**Recommended Fix:**
Implement password validation in the service layer:
```typescript
async resetPassword(
  { prisma }: AppContext,
  { token, newPassword }: { token: string; newPassword: string },
): Promise<boolean> {
  const passwordSchema = z.string()
    .min(8, "Password must be at least 8 characters")
    .regex(/[A-Z]/, "Must contain uppercase letter")
    .regex(/[0-9]/, "Must contain number")
    .regex(/[!@#$%^&*]/, "Must contain special character");
  
  const validPassword = passwordSchema.parse(newPassword);
  // ... rest of logic
}
```

---

### HIGH

#### Issue H1: No Authorization Checks for Team Member Access
**File:** src/services/userService/service.ts (lines 55-91)  
**Description:** The `getTeamMember` resolver checks that the requesting user and target user share the same `companyId`, but doesn't verify if the requesting user has permission to view that team member's sensitive data (skills, pay, documents, notes, etc.). All authenticated users can see ANY team member's complete profile.

**Current Code:**
```typescript
async getTeamMember({ prisma, userId }: AppContext, { id }: { id: string }) {
  if (!userId) {
    throw new GraphQLError("Not authenticated", ...);
  }
  
  const currentUser = await prisma.user.findUnique({
    where: { id: userId },
    select: { companyId: true },
  });
  
  // Only checks companyId match - no role/permission check
  const member = await prisma.user.findFirst({
    where: { id, companyId: currentUser.companyId },
    include: {
      company: true,
      skills: true,
      pay: true,  // Financial data!
      nextOfKin: true,
      notes: true,
      documents: true,
      prompts: true,
      roles: { include: { role: true } },
      locations: { include: { location: true } },
    },
  });
  
  return member ?? null;
}
```

**Risk:** Information disclosure - an employee can view another employee's salary, bank details, and sensitive personal information.

**Recommended Fix:**
```typescript
async getTeamMember({ prisma, userId }: AppContext, { id }: { id: string }) {
  if (!userId) {
    throw new GraphQLError("Not authenticated", ...);
  }
  
  const currentUser = await prisma.user.findUnique({
    where: { id: userId },
    select: { companyId: true, accountType: true },
  });
  
  const targetUser = await prisma.user.findFirst({
    where: { id, companyId: currentUser.companyId },
  });
  
  if (!targetUser) return null;
  
  const canViewFullProfile = ['OWNER', 'MANAGER', 'ADMIN'].includes(currentUser.accountType);
  
  if (canViewFullProfile) {
    return prisma.user.findFirst({
      where: { id, companyId: currentUser.companyId },
      include: { company: true, skills: true, pay: true, ... },
    });
  } else {
    return prisma.user.findFirst({
      where: { id, companyId: currentUser.companyId },
      include: { company: true }, // Limited data only
    });
  }
}
```

---

#### Issue H2: No Rate Limiting on Authentication Endpoints
**File:** src/index.ts (lines 1-39)  
**Description:** Magic link and password reset endpoints have no rate limiting. An attacker can spam requests to:
- `sendMagicLink` - generate unlimited magic link emails
- `requestPasswordReset` - spam password reset emails to any email address
- `login` - brute force passwords

**Current Code:**
```typescript
const app = express();
app.use(cors());
app.use(express.json());
// No rate limiting middleware

const server = new ApolloServer({ typeDefs, resolvers, stopOnTerminationSignals: false });
await server.start();

app.use("/graphql", expressMiddleware(server, { context: createContext }));
```

**Risk:** DoS attacks via email flooding, credential stuffing, spam attacks on legitimate users.

**Recommended Fix:**
```typescript
import rateLimit from 'express-rate-limit';

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5,
  keyGenerator: (req) => req.headers['x-forwarded-for'] as string || req.ip,
});

app.use('/graphql', authLimiter);
```

---

#### Issue H3: Refresh Token Rotation Not Validated Against Database Consistency
**File:** src/services/authService/index.ts (lines 107-146)  
**Description:** The refresh token endpoint generates new tokens but doesn't verify the refresh token's existence against stored tokens during the verification step. If a token is leaked and used by an attacker, there's no account-level protection.

**Risk:** If a refresh token is leaked and both the legitimate user and attacker try to use it, there's no detection of this suspicious activity. Implement "refresh token reuse detection" where if a token is used twice, all tokens for that user are invalidated.

**Recommended Fix:**
```typescript
async refreshToken(
  { prisma }: AppContext,
  { refreshToken }: { refreshToken: string },
) {
  let decoded;
  try {
    decoded = verifyRefreshToken(refreshToken);
  } catch {
    // If JWT is invalid but token exists in DB, possible attack
    const suspicious = await prisma.refreshToken.findUnique({
      where: { token: refreshToken },
    });
    if (suspicious) {
      // Revoke all tokens for this user (account takeover detected)
      await prisma.refreshToken.deleteMany({
        where: { userId: suspicious.userId },
      });
    }
    throw new GraphQLError("Invalid or expired refresh token", ...);
  }
  
  const stored = await prisma.refreshToken.findUnique({
    where: { token: refreshToken },
    select: { expiresAt: true, userId: true },
  });
  
  if (!stored || stored.expiresAt < new Date()) {
    throw new GraphQLError("Refresh token not found or expired", ...);
  }
  
  // Invalidate token + generate new ones atomically
  return prisma.$transaction(async (tx) => {
    await tx.refreshToken.delete({ where: { token: refreshToken } });
    const newTokens = {
      accessToken: generateAccessToken({ userId: decoded.userId }),
      refreshToken: generateRefreshToken({ userId: decoded.userId }),
    };
    await tx.refreshToken.create({
      data: {
        token: newTokens.refreshToken,
        userId: decoded.userId,
        expiresAt: getRefreshTokenExpiry(),
      },
    });
    return newTokens;
  });
}
```

---

#### Issue H4: PIN Field Exposed in GraphQL Schema and Returned to Client
**File:** src/schema/typeDefs.ts (lines 100-123)  
**Description:** The `pin` field is exposed in the User type and returned to clients in all queries (`me`, `users`, `teamMembers`, `teamMember`). PINs should never be sent to the client — they're a sensitive security credential.

**Current Code (typeDefs.ts):**
```graphql
type User {
  id: ID!
  firstName: String!
  lastName: String!
  email: String!
  pin: String!  # <-- Should not be exposed
  ...
}

type TeamMember {
  id: ID!
  firstName: String!
  lastName: String!
  email: String!
  pin: String!  # <-- Should not be exposed
  ...
}
```

**Risk:** PINs are sensitive security credentials. Returning them to clients enables credential theft. Even hashed PINs shouldn't be returned.

**Recommended Fix:**
Remove `pin` from GraphQL output types entirely:
```graphql
type User {
  id: ID!
  firstName: String!
  lastName: String!
  # ... other non-sensitive fields
  # Remove: pin: String!
}
```

---

#### Issue H5: Magic Link Token Not Invalidated When User Requests New One
**File:** src/services/magicLinkService/index.ts (lines 15-44)  
**Description:** While old unused tokens are invalidated before issuing a new one, there's no cooldown/rate check to prevent multiple simultaneous valid tokens being issued rapidly.

**Recommended Fix:**
```typescript
async sendMagicLink(
  { prisma }: AppContext,
  { email }: { email: string },
): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  });
  
  if (!user) return true;
  
  // Prevent hammering: check for token issued in last 60 seconds
  const recentToken = await prisma.magicLinkToken.findFirst({
    where: {
      userId: user.id,
      used: false,
      expiresAt: { gt: new Date(Date.now() - 60000) },
    },
  });
  
  if (recentToken) return true; // Silent rate limit
  
  await prisma.magicLinkToken.updateMany({
    where: { userId: user.id, used: false },
    data: { used: true },
  });
  
  // ... rest of logic
}
```

---

### MEDIUM

#### Issue M1: Missing Query Authorization for `users` Query
**File:** src/services/userService/service.ts (lines 40-53)  
**Description:** The `getUsers` query returns all users in the database without filtering by company. Any authenticated user can retrieve a complete list of all users across all companies.

**Recommended Fix:**
```typescript
async getUsers({ prisma, userId }: AppContext): Promise<UserWithCompany[]> {
  if (!userId) {
    throw new GraphQLError("Not authenticated", ...);
  }
  
  const currentUser = await prisma.user.findUnique({
    where: { id: userId },
    select: { companyId: true },
  });
  
  return prisma.user.findMany({
    where: { companyId: currentUser.companyId }, // Filter by company
    include: { company: true },
    orderBy: { createdAt: "desc" },
    take: MAX_PAGE_SIZE,
  });
}
```

---

#### Issue M2: JWT Token Expiry Parsing Bug
**File:** src/auth/jwt.ts (lines 33-36)  
**Description:** The `getRefreshTokenExpiry()` function parses `JWT_REFRESH_EXPIRES_IN` with `parseInt`, which works by accident for `"7d"` but silently fails for `"24h"` or `"1w"`, defaulting to 7 days instead.

**Recommended Fix:**
```typescript
function parseExpiryString(expiryStr: string): number {
  const match = expiryStr.match(/^(\d+)([dhms])$/);
  if (!match) return 7 * 24 * 60 * 60 * 1000;
  
  const [, value, unit] = match;
  const num = parseInt(value, 10);
  const units: Record<string, number> = {
    d: 86400000, h: 3600000, m: 60000, s: 1000,
  };
  return num * (units[unit] ?? units.d);
}

export function getRefreshTokenExpiry(): Date {
  return new Date(Date.now() + parseExpiryString(env.JWT_REFRESH_EXPIRES_IN));
}
```

---

#### Issue M3: No CORS Configuration for Production
**File:** src/index.ts (line 13)  
**Description:** CORS is enabled with default settings (allows all origins), appropriate for development but dangerous for production.

**Recommended Fix:**
```typescript
app.use(
  cors({
    origin: process.env.NODE_ENV === 'production'
      ? process.env.ALLOWED_ORIGINS?.split(',') || []
      : '*',
    credentials: true,
    methods: ['GET', 'POST', 'OPTIONS'],
  })
);
```

---

#### Issue M4: Missing Input Validation for User Registration
**File:** src/services/authService/index.ts (lines 31-73)  
**Description:** The `register` mutation doesn't validate email format, password strength, name field lengths, or PIN complexity.

**Recommended Fix:**
```typescript
const registerSchema = z.object({
  companyName: z.string().min(1).max(255),
  companyAddress: z.string().min(1).max(255),
  companyPhone: z.string().regex(/^\+?[\d\s()-]+$/),
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  email: z.string().email(),
  password: z.string().min(8).regex(/[A-Z]/).regex(/[0-9]/).regex(/[!@#$%^&*]/),
  pin: z.string().regex(/^\d{4,6}$/, "PIN must be 4-6 digits"),
});

async register({ prisma }: AppContext, args: unknown) {
  const validated = registerSchema.parse(args);
  // ...
}
```

---

#### Issue M5: No Logging or Audit Trail for Security Events
**File:** All service files  
**Description:** Authentication events (login, password reset, magic link verification) are not logged. There's no audit trail for security investigations or forensic data for breach analysis.

**Recommended Fix:**
Create an `AuditLog` Prisma model and an audit service:
```typescript
export const auditService = {
  async log(prisma: PrismaClient, event: {
    userId?: string;
    action: string;
    resource: string;
    success: boolean;
    details?: unknown;
  }) {
    await prisma.auditLog.create({ data: event });
  },
};
```

---

#### Issue M6: No Proper Graceful Shutdown Timeout
**File:** src/index.ts (lines 25-38)  
**Description:** The shutdown handler doesn't have a timeout. If the server doesn't stop in time, the process hangs indefinitely.

**Recommended Fix:**
```typescript
const shutdown = async (): Promise<void> => {
  const shutdownTimeout = setTimeout(() => {
    console.error('Shutdown timeout - forcing exit');
    process.exit(1);
  }, 30000);
  
  try {
    httpServer.close();
    await server.stop();
    await prisma.$disconnect();
    clearTimeout(shutdownTimeout);
  } catch (error) {
    console.error('Error during shutdown:', error);
    process.exit(1);
  }
};
```

---

### LOW

#### Issue L1: Missing Runtime Enum Validation in teamMembers Filter
**File:** src/services/userService/utils.ts (lines 16-29)  
**Description:** `status` and `accountType` enum values from the GraphQL filter are cast directly to Prisma types using `as` without runtime validation.

**Recommended Fix:**
```typescript
const UserStatusSchema = z.enum(['PENDING', 'ACTIVE', 'INACTIVE']);
const AccountTypeSchema = z.enum(['OWNER', 'EMPLOYEE', 'MANAGER', 'ADMIN']);

if (filter.status) {
  const parsed = UserStatusSchema.safeParse(filter.status);
  if (parsed.success) AND.push({ status: parsed.data as Prisma.EnumUserStatusFilter });
}
```

---

#### Issue L2: Database Connection Pool Not Configured
**File:** src/db.ts  
**Description:** Prisma client uses default pool settings. Under production load, connection exhaustion could degrade performance.

**Recommended Fix:**
Configure the pool in the `DATABASE_URL` connection string:
```
DATABASE_URL="postgresql://...?connection_limit=10&pool_timeout=10"
```

---

#### Issue L3: No TypeScript Strict Null Checks on Optional Relations
**File:** src/services/userService/service.ts (line 91)  
**Description:** Included relations (e.g., `pay`, nullable unique relation) can be null at runtime but are not guarded in code that consumes them.

---

#### Issue L4: Inconsistent Error Codes in GraphQL Errors
**File:** src/services/ (multiple files)  
**Description:** Both "no token provided" and "wrong password" use `UNAUTHENTICATED`, making it hard for clients and monitoring to distinguish between scenarios.

**Recommended Fix:**
```typescript
const ErrorCodes = {
  UNAUTHENTICATED: 'UNAUTHENTICATED',     // No auth provided
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS', // Wrong password/email
  INVALID_TOKEN: 'INVALID_TOKEN',          // Token expired/malformed
  UNAUTHORIZED: 'UNAUTHORIZED',            // Auth ok but no permission
  NOT_FOUND: 'NOT_FOUND',
  BAD_USER_INPUT: 'BAD_USER_INPUT',
} as const;
```

---

## Quick Wins

High-impact, low-effort improvements (total ~8 hours):

| # | Fix | File | Est. Time | Closes |
|---|-----|------|-----------|--------|
| 1 | Remove `pin` field from User/TeamMember GraphQL types | src/schema/typeDefs.ts | 1h | H4 |
| 2 | Add password validation to register and resetPassword | src/services/authService, passwordResetService | 2h | C2, M4 |
| 3 | Fix JWT expiry parsing in `getRefreshTokenExpiry()` | src/auth/jwt.ts | 1h | M2 |
| 4 | Add company filter to `getUsers` query | src/services/userService/service.ts | 30min | M1 |
| 5 | Invalidate all reset tokens on password change | src/services/passwordResetService/index.ts | 30min | C1 |
| 6 | Add graceful shutdown timeout | src/index.ts | 1h | M6 |
| 7 | Add enum validation to `buildFilterWhere` | src/services/userService/utils.ts | 1h | L1 |

---

## Roadmap

### Phase 1: Security Hardening (1-2 weeks)
- Implement password/PIN validation schemas (Zod)
- Add rate limiting — `express-rate-limit` on auth endpoints
- Implement role-based access control (RBAC) based on `accountType`
- Add audit logging — create `AuditLog` model and log all auth events
- Implement refresh token reuse detection
- Invalidate all reset tokens on password change (C1)

### Phase 2: Production Readiness (2-3 weeks)
- Structured logging — pino or winston instead of `console.log`
- Error tracking — Sentry or similar
- GraphQL persisted queries — prevent arbitrary query execution
- Request tracing — correlation IDs for debugging
- Health check endpoint — readiness/liveness probes for orchestrators
- CORS locked to allowed origins

### Phase 3: Scalability (3-4 weeks)
- DataLoader for N+1 prevention on nested relations
- Database query optimization — add indexes on frequently filtered fields
- Caching strategy — Redis for session tokens and user profiles
- GraphQL query complexity analysis — prevent expensive queries
- Database connection pool tuning

### Phase 4: Operations (ongoing)
- Observability dashboard — auth success/failure rates
- Alert rules — spike in failed logins, token reuse attempts
- Load testing — establish performance baselines
- Quarterly dependency security audits

---

## Recommended Architecture Patterns

### 1. Middleware for Cross-Cutting Concerns
```typescript
// src/middleware/index.ts
export function createMiddleware() {
  return [
    rateLimitMiddleware(),
    loggingMiddleware(),
    performanceMiddleware(),
  ];
}
```

### 2. Repository Pattern for Data Access
```typescript
// src/repositories/userRepository.ts
export const userRepository = {
  async findById(id: string) { ... },
  async findByEmail(email: string) { ... },
  async create(data: CreateUserInput) { ... },
};
```

### 3. Custom Error Classes
```typescript
// src/errors/index.ts
export class AuthenticationError extends GraphQLError {
  constructor(message: string) {
    super(message, { extensions: { code: 'UNAUTHENTICATED' } });
  }
}

export class AuthorizationError extends GraphQLError {
  constructor(message: string) {
    super(message, { extensions: { code: 'UNAUTHORIZED' } });
  }
}
```

### 4. Centralized Input Validation Schemas
```typescript
// src/schemas/auth.ts
export const passwordSchema = z.string()
  .min(8)
  .regex(/[A-Z]/)
  .regex(/[0-9]/)
  .regex(/[!@#$%^&*]/);

export const registerSchema = z.object({
  email: z.string().email(),
  password: passwordSchema,
  pin: z.string().regex(/^\d{4,6}$/),
  // ...
});
```

---

## Testing Recommendations

### Priority 1 — Unit Tests
- Zod validation schemas
- JWT generation and verification
- Password hashing utilities
- Filter/search utilities (`utils.ts`)

### Priority 2 — Integration Tests
- User registration flow
- Login with valid/invalid credentials
- Magic link send and verify cycle
- Password reset flow
- Token refresh and revocation

### Priority 3 — E2E Tests
- Full authentication cycle
- Multi-user team member access
- Permission enforcement by role

### Priority 4 — Security Tests
- Rate limiting bypass attempts
- Token reuse detection
- Brute force detection
- Input injection (via Prisma parameterization)

---

## Conclusion

**Overall Assessment:** The moonpod-backend demonstrates solid foundational architecture with clean service separation, proper TypeScript usage, and thoughtful authentication patterns. However, it requires security hardening before production deployment — particularly around authorization checks, rate limiting, input validation, and audit logging.

**Immediate Actions Required (in order):**
1. Add role-based authorization checks to team member queries (H1)
2. Add rate limiting to authentication endpoints (H2)
3. Remove PIN from GraphQL responses (H4)
4. Invalidate all reset tokens on password change (C1)
5. Add company filter to `getUsers` query (M1)

**Timeline to Production:** 4-6 weeks with focused work on the roadmap phases above.
