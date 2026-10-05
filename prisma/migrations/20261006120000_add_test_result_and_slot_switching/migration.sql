-- CreateEnum
CREATE TYPE "TestResult" AS ENUM ('PENDING', 'PASSED', 'FAILED');

-- AlterTable
ALTER TABLE "recruitment_cycles" ADD COLUMN     "test_slot_switching_enabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "interview_slot_switching_enabled" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "registration_submissions" ADD COLUMN     "test_result" "TestResult" NOT NULL DEFAULT 'PENDING',
ADD COLUMN     "test_result_updated_at" TIMESTAMPTZ(3);
