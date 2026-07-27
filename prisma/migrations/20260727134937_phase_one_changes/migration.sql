/*
  Warnings:

  - The values [REJECTED] on the enum `PaymentStatus` will be removed. If these variants are still used in the database, this will fail.
  - The values [EMAIL_VERIFICATION,PASSWORD_SETUP] on the enum `VerificationCodePurpose` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `options` on the `form_fields` table. All the data in the column will be lost.
  - You are about to drop the column `validation_rules` on the `form_fields` table. All the data in the column will be lost.
  - You are about to drop the column `field_help_text` on the `form_input_submissions` table. All the data in the column will be lost.
  - You are about to drop the column `field_options` on the `form_input_submissions` table. All the data in the column will be lost.
  - You are about to drop the column `channel` on the `registration_submissions` table. All the data in the column will be lost.
  - You are about to drop the column `email` on the `users` table. All the data in the column will be lost.
  - Made the column `field_id` on table `form_input_submissions` required. This step will fail if there are existing NULL values in that column.
  - Added the required column `collegeEmail` to the `users` table without a default value. This is not possible if the table is not empty.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "PaymentStatus_new" AS ENUM ('UNPAID', 'PAID');
ALTER TABLE "public"."registration_submissions" ALTER COLUMN "payment_status" DROP DEFAULT;
ALTER TABLE "registration_submissions" ALTER COLUMN "payment_status" TYPE "PaymentStatus_new" USING ("payment_status"::text::"PaymentStatus_new");
ALTER TYPE "PaymentStatus" RENAME TO "PaymentStatus_old";
ALTER TYPE "PaymentStatus_new" RENAME TO "PaymentStatus";
DROP TYPE "public"."PaymentStatus_old";
ALTER TABLE "registration_submissions" ALTER COLUMN "payment_status" SET DEFAULT 'UNPAID';
COMMIT;

-- AlterEnum
BEGIN;
CREATE TYPE "VerificationCodePurpose_new" AS ENUM ('ACTIVATION', 'PASSWORD_RESET');
ALTER TABLE "verification_codes" ALTER COLUMN "purpose" TYPE "VerificationCodePurpose_new" USING ("purpose"::text::"VerificationCodePurpose_new");
ALTER TYPE "VerificationCodePurpose" RENAME TO "VerificationCodePurpose_old";
ALTER TYPE "VerificationCodePurpose_new" RENAME TO "VerificationCodePurpose";
DROP TYPE "public"."VerificationCodePurpose_old";
COMMIT;

-- DropForeignKey
ALTER TABLE "form_input_submissions" DROP CONSTRAINT "form_input_submissions_field_id_fkey";

-- DropForeignKey
ALTER TABLE "registration_submissions" DROP CONSTRAINT "registration_submissions_decided_by_id_fkey";

-- DropForeignKey
ALTER TABLE "registration_submissions" DROP CONSTRAINT "registration_submissions_payment_verified_by_id_fkey";

-- AlterTable
ALTER TABLE "form_fields" DROP COLUMN "options",
DROP COLUMN "validation_rules",
ADD COLUMN     "enum" TEXT;

-- AlterTable
ALTER TABLE "form_input_submissions" DROP COLUMN "field_help_text",
DROP COLUMN "field_options",
ALTER COLUMN "field_id" SET NOT NULL,
ALTER COLUMN "value" SET DATA TYPE TEXT;

-- AlterTable
ALTER TABLE "registration_submissions" DROP COLUMN "channel";

-- AlterTable
ALTER TABLE "users" DROP COLUMN "email",
ADD COLUMN     "collegeEmail" VARCHAR(320) NOT NULL,
ADD COLUMN     "personal_email" VARCHAR(320);

-- DropEnum
DROP TYPE "RegistrationChannel";

-- CreateTable
CREATE TABLE "interview_slots" (
    "id" UUID NOT NULL,
    "recruitment_cycle_id" UUID NOT NULL,
    "interviewer_name" VARCHAR(200) NOT NULL,
    "start_time" TIMESTAMPTZ(3) NOT NULL,
    "end_time" TIMESTAMPTZ(3) NOT NULL,
    "location" TEXT,
    "meeting_url" TEXT,
    "capacity" INTEGER NOT NULL DEFAULT 1,
    "is_cancelled" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "interview_slots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "slot_bookings" (
    "id" UUID NOT NULL,
    "submission_id" UUID NOT NULL,
    "slot_id" UUID NOT NULL,
    "booked_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cancelled_at" TIMESTAMPTZ(3),

    CONSTRAINT "slot_bookings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL,
    "actor_id" UUID,
    "action" VARCHAR(100) NOT NULL,
    "target_entity" VARCHAR(100) NOT NULL,
    "target_id" UUID NOT NULL,
    "previous_state" JSONB,
    "new_state" JSONB,
    "note" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "interview_slots_recruitment_cycle_id_start_time_idx" ON "interview_slots"("recruitment_cycle_id", "start_time");

-- CreateIndex
CREATE UNIQUE INDEX "slot_bookings_submission_id_key" ON "slot_bookings"("submission_id");

-- CreateIndex
CREATE INDEX "slot_bookings_slot_id_idx" ON "slot_bookings"("slot_id");

-- CreateIndex
CREATE INDEX "audit_logs_target_entity_target_id_idx" ON "audit_logs"("target_entity", "target_id");

-- CreateIndex
CREATE INDEX "audit_logs_actor_id_idx" ON "audit_logs"("actor_id");

-- AddForeignKey
ALTER TABLE "registration_submissions" ADD CONSTRAINT "registration_submissions_payment_verified_by_id_fkey" FOREIGN KEY ("payment_verified_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "registration_submissions" ADD CONSTRAINT "registration_submissions_decided_by_id_fkey" FOREIGN KEY ("decided_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "form_input_submissions" ADD CONSTRAINT "form_input_submissions_field_id_fkey" FOREIGN KEY ("field_id") REFERENCES "form_fields"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interview_slots" ADD CONSTRAINT "interview_slots_recruitment_cycle_id_fkey" FOREIGN KEY ("recruitment_cycle_id") REFERENCES "recruitment_cycles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "slot_bookings" ADD CONSTRAINT "slot_bookings_submission_id_fkey" FOREIGN KEY ("submission_id") REFERENCES "registration_submissions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "slot_bookings" ADD CONSTRAINT "slot_bookings_slot_id_fkey" FOREIGN KEY ("slot_id") REFERENCES "interview_slots"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
