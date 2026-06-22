import { z } from "zod";

export const loginSchema = z.object({
  username: z
    .string()
    .trim()
    .min(1, "Enter your username.")
    .max(80, "Username must be 80 characters or fewer."),
  password: z
    .string()
    .min(8, "Password must contain at least 8 characters.")
    .max(128, "Password must be 128 characters or fewer."),
});

export type LoginValues = z.infer<typeof loginSchema>;
