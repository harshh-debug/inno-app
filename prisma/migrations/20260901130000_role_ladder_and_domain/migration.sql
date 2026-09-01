-- CreateEnum
CREATE TYPE "Domain" AS ENUM ('ANDROID', 'WEB', 'ML', 'IOT', 'AR_VR');

-- AlterEnum
BEGIN;
CREATE TYPE "PlatformRole_new" AS ENUM ('REGISTERED', 'MEMBER', 'COORDINATOR', 'ADMIN');
ALTER TABLE "public"."users" ALTER COLUMN "role" DROP DEFAULT;
ALTER TABLE "users" ALTER COLUMN "role" TYPE "PlatformRole_new" USING ("role"::text::"PlatformRole_new");
ALTER TYPE "PlatformRole" RENAME TO "PlatformRole_old";
ALTER TYPE "PlatformRole_new" RENAME TO "PlatformRole";
DROP TYPE "public"."PlatformRole_old";
ALTER TABLE "users" ALTER COLUMN "role" SET DEFAULT 'REGISTERED';
COMMIT;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "domain" "Domain",
ALTER COLUMN "role" SET DEFAULT 'REGISTERED';

