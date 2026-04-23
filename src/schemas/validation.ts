import { z } from "zod";

export const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .max(128, "Password must be at most 128 characters");

export const pinSchema = z
  .string()
  .regex(/^\d{4,6}$/, "PIN must be 4 to 6 digits");

export const registerSchema = z.object({
  companyName: z.string().min(1, "Company name is required").max(255),
  companyAddress: z.string().min(1, "Company address is required").max(255),
  companyPhone: z.string().min(1, "Phone is required").max(50),
  firstName: z.string().min(1, "First name is required").max(100),
  lastName: z.string().min(1, "Last name is required").max(100),
  email: z.string().email("Invalid email address"),
  password: passwordSchema,
  pin: pinSchema,
});
