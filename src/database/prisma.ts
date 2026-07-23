import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../generated/prisma/client.js";
import type { Environment } from "../config/environment.js";

export function createPrismaClient(environment: Pick<Environment, "DATABASE_URL">): PrismaClient {
  const adapter = new PrismaPg({ connectionString: environment.DATABASE_URL });
  return new PrismaClient({ adapter });
}
