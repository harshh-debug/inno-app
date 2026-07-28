import { PlatformRole } from "../../generated/prisma/client.js";
import { loadAdminSeedEnvironment, loadEnvironment } from "../config/environment.js";
import { createPrismaClient } from "../database/prisma.js";
import { hashPassword } from "../modules/authentication/password.js";
import { createUsersModule } from "../modules/users/users.module.js";

const environment = loadEnvironment();
const seed = loadAdminSeedEnvironment();
const prisma = createPrismaClient(environment);

try {
  const users = createUsersModule(prisma);
  const result = await users.userService.provisionControlledAdmin({
    collegeEmail: seed.ADMIN_SEED_EMAIL,
    role: PlatformRole.ADMIN,
    passwordHash: await hashPassword(seed.ADMIN_SEED_PASSWORD),
  });
  console.info(result.created ? "Admin created" : "Admin already exists");
} finally {
  await prisma.$disconnect();
}
