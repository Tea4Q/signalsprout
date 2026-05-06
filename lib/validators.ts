import { z } from "zod";

export const emailSchema = z
  .string()
  .min(1, "Email is required")
  .email("Enter a valid email address");

export const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
  .regex(/[0-9]/, "Password must contain at least one number");

export const workspaceSlugSchema = z
  .string()
  .min(2, "Slug must be at least 2 characters")
  .max(48, "Slug must be at most 48 characters")
  .regex(
    /^[a-z0-9-]+$/,
    "Slug may only contain lowercase letters, numbers, and hyphens",
  );

export const brandSlugSchema = z
  .string()
  .min(2, "Slug must be at least 2 characters")
  .max(48, "Slug must be at most 48 characters")
  .regex(
    /^[a-z0-9-]+$/,
    "Slug may only contain lowercase letters, numbers, and hyphens",
  );

export const signInSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Password is required"),
});

export const signUpSchema = z
  .object({
    email: emailSchema,
    password: passwordSchema,
    confirmPassword: z.string().min(1, "Please confirm your password"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export const forgotPasswordSchema = z.object({
  email: emailSchema,
});

export type SignInInput = z.infer<typeof signInSchema>;
export type SignUpInput = z.infer<typeof signUpSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
