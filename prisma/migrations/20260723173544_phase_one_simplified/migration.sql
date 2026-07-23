-- CreateEnum
CREATE TYPE "PlatformRole" AS ENUM ('FIRST_YEAR_STUDENT', 'COORDINATOR', 'ADMIN');

-- CreateEnum
CREATE TYPE "InputType" AS ENUM ('TEXT', 'TEXTAREA', 'EMAIL', 'PHONE', 'NUMBER', 'DATE', 'SELECT', 'MULTI_SELECT', 'CHECKBOX');

-- CreateEnum
CREATE TYPE "RegistrationChannel" AS ENUM ('WEB', 'APP');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('UNPAID', 'PAID', 'REJECTED');

-- CreateEnum
CREATE TYPE "RecruitmentDecision" AS ENUM ('PENDING', 'SELECTED', 'WAITLISTED', 'REJECTED');

-- CreateEnum
CREATE TYPE "VerificationCodePurpose" AS ENUM ('EMAIL_VERIFICATION', 'PASSWORD_SETUP', 'PASSWORD_RESET');

-- CreateEnum
CREATE TYPE "TimelineEventType" AS ENUM ('TEST', 'INTERVIEW', 'CUSTOM');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "email" VARCHAR(320) NOT NULL,
    "normalized_email" VARCHAR(320) NOT NULL,
    "password_hash" TEXT,
    "email_verified_at" TIMESTAMPTZ(3),
    "role" "PlatformRole" NOT NULL DEFAULT 'FIRST_YEAR_STUDENT',
    "is_suspended" BOOLEAN NOT NULL DEFAULT false,
    "full_name" VARCHAR(200),
    "phone" VARCHAR(40),
    "batch" VARCHAR(100),
    "year" INTEGER,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recruitment_cycles" (
    "id" UUID NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "academic_year" VARCHAR(30) NOT NULL,
    "fee_amount" INTEGER NOT NULL DEFAULT 50,
    "is_active" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "recruitment_cycles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "forms" (
    "id" UUID NOT NULL,
    "recruitment_cycle_id" UUID NOT NULL,
    "title" VARCHAR(300) NOT NULL DEFAULT 'Registration Form',
    "description" TEXT,
    "submit_button_label" VARCHAR(100) NOT NULL DEFAULT 'Submit',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "forms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "form_fields" (
    "id" UUID NOT NULL,
    "form_id" UUID NOT NULL,
    "key" VARCHAR(100) NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "help_text" TEXT,
    "type" "InputType" NOT NULL,
    "placeholder" VARCHAR(300),
    "options" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "required" BOOLEAN NOT NULL DEFAULT false,
    "order" INTEGER NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "min_length" INTEGER,
    "max_length" INTEGER,
    "min_value" DOUBLE PRECISION,
    "max_value" DOUBLE PRECISION,
    "validation_rules" JSONB,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "form_fields_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "registration_submissions" (
    "id" UUID NOT NULL,
    "application_number" SERIAL NOT NULL,
    "user_id" UUID NOT NULL,
    "recruitment_cycle_id" UUID NOT NULL,
    "form_id" UUID NOT NULL,
    "channel" "RegistrationChannel" NOT NULL,
    "payment_status" "PaymentStatus" NOT NULL DEFAULT 'UNPAID',
    "payment_verified_at" TIMESTAMPTZ(3),
    "payment_verified_by_id" UUID,
    "payment_reference" VARCHAR(200),
    "payment_note" TEXT,
    "decision" "RecruitmentDecision" NOT NULL DEFAULT 'PENDING',
    "decision_note" TEXT,
    "decided_at" TIMESTAMPTZ(3),
    "decided_by_id" UUID,
    "submitted_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "registration_submissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "form_input_submissions" (
    "id" UUID NOT NULL,
    "submission_id" UUID NOT NULL,
    "field_id" UUID,
    "field_key" VARCHAR(100) NOT NULL,
    "field_title" VARCHAR(200) NOT NULL,
    "field_help_text" TEXT,
    "field_type" "InputType" NOT NULL,
    "field_options" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "value" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "form_input_submissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification_codes" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "normalized_email" VARCHAR(320) NOT NULL,
    "purpose" "VerificationCodePurpose" NOT NULL,
    "code_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "failed_attempts" INTEGER NOT NULL DEFAULT 0,
    "max_attempts" INTEGER NOT NULL DEFAULT 5,
    "resend_available_at" TIMESTAMPTZ(3) NOT NULL,
    "used_at" TIMESTAMPTZ(3),
    "invalidated_at" TIMESTAMPTZ(3),
    "action_token_hash" TEXT,
    "action_token_expires_at" TIMESTAMPTZ(3),
    "action_token_used_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "verification_codes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recruitment_timeline_events" (
    "id" UUID NOT NULL,
    "recruitment_cycle_id" UUID NOT NULL,
    "type" "TimelineEventType" NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "description" TEXT,
    "scheduled_at" TIMESTAMPTZ(3),
    "location" TEXT,
    "meeting_url" TEXT,
    "instructions" TEXT,
    "order" INTEGER NOT NULL,
    "is_visible" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "recruitment_timeline_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_normalized_email_key" ON "users"("normalized_email");

-- CreateIndex
CREATE INDEX "users_role_idx" ON "users"("role");

-- CreateIndex
CREATE INDEX "users_full_name_idx" ON "users"("full_name");

-- CreateIndex
CREATE INDEX "recruitment_cycles_is_active_idx" ON "recruitment_cycles"("is_active");

-- CreateIndex
CREATE UNIQUE INDEX "forms_recruitment_cycle_id_key" ON "forms"("recruitment_cycle_id");

-- CreateIndex
CREATE INDEX "form_fields_form_id_is_active_order_idx" ON "form_fields"("form_id", "is_active", "order");

-- CreateIndex
CREATE UNIQUE INDEX "form_fields_form_id_key_key" ON "form_fields"("form_id", "key");

-- CreateIndex
CREATE UNIQUE INDEX "form_fields_form_id_order_key" ON "form_fields"("form_id", "order");

-- CreateIndex
CREATE UNIQUE INDEX "registration_submissions_application_number_key" ON "registration_submissions"("application_number");

-- CreateIndex
CREATE INDEX "registration_submissions_recruitment_cycle_id_payment_statu_idx" ON "registration_submissions"("recruitment_cycle_id", "payment_status");

-- CreateIndex
CREATE INDEX "registration_submissions_recruitment_cycle_id_decision_idx" ON "registration_submissions"("recruitment_cycle_id", "decision");

-- CreateIndex
CREATE UNIQUE INDEX "registration_submissions_user_id_recruitment_cycle_id_key" ON "registration_submissions"("user_id", "recruitment_cycle_id");

-- CreateIndex
CREATE INDEX "form_input_submissions_submission_id_idx" ON "form_input_submissions"("submission_id");

-- CreateIndex
CREATE UNIQUE INDEX "form_input_submissions_submission_id_field_key_key" ON "form_input_submissions"("submission_id", "field_key");

-- CreateIndex
CREATE UNIQUE INDEX "verification_codes_action_token_hash_key" ON "verification_codes"("action_token_hash");

-- CreateIndex
CREATE INDEX "verification_codes_user_id_purpose_expires_at_idx" ON "verification_codes"("user_id", "purpose", "expires_at");

-- CreateIndex
CREATE INDEX "verification_codes_normalized_email_purpose_idx" ON "verification_codes"("normalized_email", "purpose");

-- CreateIndex
CREATE INDEX "recruitment_timeline_events_recruitment_cycle_id_is_visible_idx" ON "recruitment_timeline_events"("recruitment_cycle_id", "is_visible", "order");

-- CreateIndex
CREATE UNIQUE INDEX "recruitment_timeline_events_recruitment_cycle_id_order_key" ON "recruitment_timeline_events"("recruitment_cycle_id", "order");

-- AddForeignKey
ALTER TABLE "forms" ADD CONSTRAINT "forms_recruitment_cycle_id_fkey" FOREIGN KEY ("recruitment_cycle_id") REFERENCES "recruitment_cycles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "form_fields" ADD CONSTRAINT "form_fields_form_id_fkey" FOREIGN KEY ("form_id") REFERENCES "forms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "registration_submissions" ADD CONSTRAINT "registration_submissions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "registration_submissions" ADD CONSTRAINT "registration_submissions_recruitment_cycle_id_fkey" FOREIGN KEY ("recruitment_cycle_id") REFERENCES "recruitment_cycles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "registration_submissions" ADD CONSTRAINT "registration_submissions_form_id_fkey" FOREIGN KEY ("form_id") REFERENCES "forms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "registration_submissions" ADD CONSTRAINT "registration_submissions_payment_verified_by_id_fkey" FOREIGN KEY ("payment_verified_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "registration_submissions" ADD CONSTRAINT "registration_submissions_decided_by_id_fkey" FOREIGN KEY ("decided_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "form_input_submissions" ADD CONSTRAINT "form_input_submissions_submission_id_fkey" FOREIGN KEY ("submission_id") REFERENCES "registration_submissions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "form_input_submissions" ADD CONSTRAINT "form_input_submissions_field_id_fkey" FOREIGN KEY ("field_id") REFERENCES "form_fields"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "verification_codes" ADD CONSTRAINT "verification_codes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recruitment_timeline_events" ADD CONSTRAINT "recruitment_timeline_events_recruitment_cycle_id_fkey" FOREIGN KEY ("recruitment_cycle_id") REFERENCES "recruitment_cycles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
