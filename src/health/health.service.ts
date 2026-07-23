import type { PrismaClient } from "../../generated/prisma/client.js";

export class HealthService {
  constructor(private readonly prisma: PrismaClient) {}

  async isDatabaseReady(): Promise<boolean> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return true;
    } catch {
      return false;
    }
  }
}
