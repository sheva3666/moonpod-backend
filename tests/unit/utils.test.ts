import { buildOrderBy } from "../../src/services/userService/utils.js";

describe("buildOrderBy", () => {
  it("maps a known sort field to its Prisma orderBy shape", () => {
    expect(buildOrderBy("EMAIL", "asc")).toEqual({ email: "asc" });
  });

  it("preserves the requested sort direction", () => {
    expect(buildOrderBy("LAST_NAME", "desc")).toEqual({ lastName: "desc" });
  });

  it("falls back to createdAt for an unknown sort field", () => {
    expect(buildOrderBy("NOT_A_REAL_FIELD", "asc")).toEqual({ createdAt: "asc" });
  });
});
