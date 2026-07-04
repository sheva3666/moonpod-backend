import { passwordSchema, pinSchema } from "../../src/schemas/validation.js";

describe("passwordSchema", () => {
  it("accepts a password within the length bounds", () => {
    expect(passwordSchema.safeParse("goodpass123").success).toBe(true);
  });

  it("rejects a password shorter than 8 characters", () => {
    expect(passwordSchema.safeParse("short").success).toBe(false);
  });
});

describe("pinSchema", () => {
  it("accepts a 4 to 6 digit PIN", () => {
    expect(pinSchema.safeParse("1234").success).toBe(true);
    expect(pinSchema.safeParse("123456").success).toBe(true);
  });

  it("rejects a PIN with non-digit characters", () => {
    expect(pinSchema.safeParse("12ab").success).toBe(false);
  });
});
