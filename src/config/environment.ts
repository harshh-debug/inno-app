import "dotenv/config";
import { z } from "zod";

const environmentSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().min(1).max(65_535).default(3000),
  DATABASE_URL: z.url(),
  REDIS_URL: z.url(),
  APP_URL: z.url().default("http://localhost:3000"),
  JWT_SECRET: z.string().min(32),
  VERIFICATION_HASH_SECRET: z.string().min(32),
});

export type Environment = z.infer<typeof environmentSchema>;

export function loadEnvironment(input: NodeJS.ProcessEnv = process.env): Environment {
  const parsed = environmentSchema.safeParse(input);

  if (!parsed.success) {
    throw new Error(`Invalid environment configuration: ${parsed.error.issues.map((issue) => issue.path.join(".")).join(", ")}`);
  }

  return parsed.data;
}

const adminSeedEnvironmentSchema = z.object({
  ADMIN_SEED_EMAIL: z.email(),
  ADMIN_SEED_PASSWORD: z.string().min(8).max(128),
});

export type AdminSeedEnvironment = z.infer<typeof adminSeedEnvironmentSchema>;

export function loadAdminSeedEnvironment(input: NodeJS.ProcessEnv = process.env): AdminSeedEnvironment {
  const parsed = adminSeedEnvironmentSchema.safeParse(input);
  if (!parsed.success) {
    throw new Error(
      `Invalid admin seed configuration: ${parsed.error.issues.map((issue) => issue.path.join(".")).join(", ")}`,
    );
  }
  return parsed.data;
}

const emailWorkerEnvironmentSchema = z
  .object({
    REDIS_URL: z.url(),
    SMTP_HOST: z.string().trim().min(1),
    SMTP_PORT: z.coerce.number().int().min(1).max(65_535),
    SMTP_SECURE: z.enum(["true", "false"]).default("false").transform((value) => value === "true"),
    SMTP_FROM: z.string().trim().min(1),
    SMTP_USER: z.string().trim().min(1).optional(),
    SMTP_PASSWORD: z.string().min(1).optional(),
  })
  .superRefine((value, context) => {
    if ((value.SMTP_USER === undefined) !== (value.SMTP_PASSWORD === undefined)) {
      context.addIssue({
        code: "custom",
        message: "SMTP_USER and SMTP_PASSWORD must be provided together",
        path: ["SMTP_USER"],
      });
    }
  });

export type EmailWorkerEnvironment = z.infer<typeof emailWorkerEnvironmentSchema>;

/** Worker-only configuration. The API process does not need SMTP credentials. */
export function loadEmailWorkerEnvironment(
  input: NodeJS.ProcessEnv = process.env,
): EmailWorkerEnvironment {
  const parsed = emailWorkerEnvironmentSchema.safeParse(input);

  if (!parsed.success) {
    throw new Error(
      `Invalid email worker configuration: ${parsed.error.issues.map((issue) => issue.path.join(".")).join(", ")}`,
    );
  }

  return parsed.data;
}
