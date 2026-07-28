-- Innogeeks Phase 1 baseline.
-- Development data and previous transitional migrations are intentionally reset.

CREATE SCHEMA IF NOT EXISTS "public";

CREATE TYPE "PlatformRole" AS ENUM ('FIRST_YEAR_STUDENT', 'COORDINATOR', 'ADMIN');
CREATE TYPE "InputType" AS ENUM ('TEXT', 'TEXTAREA', 'EMAIL', 'PHONE', 'NUMBER', 'DATE', 'SELECT', 'MULTI_SELECT', 'CHECKBOX');
CREATE TYPE "PaymentStatus" AS ENUM ('UNPAID', 'PAID');
CREATE TYPE "RecruitmentDecision" AS ENUM ('PENDING', 'SELECTED', 'WAITLISTED', 'REJECTED');
CREATE TYPE "VerificationCodePurpose" AS ENUM ('EMAIL_VERIFICATION', 'PASSWORD_RESET');
CREATE TYPE "TimelineEventType" AS ENUM ('TEST', 'INTERVIEW', 'CUSTOM');

CREATE TABLE "users" (
  "id" UUID NOT NULL,
  "collegeEmail" VARCHAR(320) NOT NULL,
  "personal_email" VARCHAR(320),
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

CREATE TABLE "recruitment_cycles" (
  "id" UUID NOT NULL,
  "name" VARCHAR(200) NOT NULL,
  "academic_year" VARCHAR(30) NOT NULL,
  "is_active" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "recruitment_cycles_pkey" PRIMARY KEY ("id")
);

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

CREATE TABLE "form_fields" (
  "id" UUID NOT NULL,
  "form_id" UUID NOT NULL,
  "key" VARCHAR(100) NOT NULL,
  "title" VARCHAR(200) NOT NULL,
  "help_text" TEXT,
  "type" "InputType" NOT NULL,
  "placeholder" VARCHAR(300),
  "enum" TEXT,
  "required" BOOLEAN NOT NULL DEFAULT false,
  "order" INTEGER NOT NULL,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "min_length" INTEGER,
  "max_length" INTEGER,
  "min_value" DOUBLE PRECISION,
  "max_value" DOUBLE PRECISION,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "form_fields_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "registration_submissions" (
  "id" UUID NOT NULL,
  "application_number" SERIAL NOT NULL,
  "user_id" UUID NOT NULL,
  "recruitment_cycle_id" UUID NOT NULL,
  "form_id" UUID NOT NULL,
  "payment_status" "PaymentStatus" NOT NULL DEFAULT 'UNPAID',
  "payment_status_updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "decision" "RecruitmentDecision" NOT NULL DEFAULT 'PENDING',
  "decision_note" TEXT,
  "decided_at" TIMESTAMPTZ(3),
  "decided_by_id" UUID,
  "submitted_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "registration_submissions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "form_input_submissions" (
  "id" UUID NOT NULL,
  "submission_id" UUID NOT NULL,
  "field_id" UUID NOT NULL,
  "field_key" VARCHAR(100) NOT NULL,
  "field_title" VARCHAR(200) NOT NULL,
  "field_type" "InputType" NOT NULL,
  "value" TEXT NOT NULL,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "form_input_submissions_pkey" PRIMARY KEY ("id")
);

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

CREATE TABLE "test_slots" (
  "id" UUID NOT NULL,
  "recruitment_cycle_id" UUID NOT NULL,
  "start_time" TIMESTAMPTZ(3) NOT NULL,
  "end_time" TIMESTAMPTZ(3) NOT NULL,
  "order" INTEGER NOT NULL,
  "is_visible" BOOLEAN NOT NULL DEFAULT false,
  "capacity" INTEGER NOT NULL DEFAULT 1,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "test_slots_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "test_slots_capacity_positive_check" CHECK ("capacity" > 0),
  CONSTRAINT "test_slots_end_after_start_check" CHECK ("end_time" > "start_time")
);

CREATE TABLE "test_slot_bookings" (
  "id" UUID NOT NULL,
  "submission_id" UUID NOT NULL,
  "test_slot_id" UUID NOT NULL,
  "booked_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "test_slot_bookings_pkey" PRIMARY KEY ("id")
);

-- Future structures are retained but have no Phase 1 routes or services.
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

CREATE TABLE "slot_bookings" (
  "id" UUID NOT NULL,
  "submission_id" UUID NOT NULL,
  "slot_id" UUID NOT NULL,
  "booked_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "cancelled_at" TIMESTAMPTZ(3),
  CONSTRAINT "slot_bookings_pkey" PRIMARY KEY ("id")
);

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

CREATE UNIQUE INDEX "users_normalized_email_key" ON "users"("normalized_email");
CREATE INDEX "users_role_idx" ON "users"("role");
CREATE INDEX "users_full_name_idx" ON "users"("full_name");
CREATE UNIQUE INDEX "recruitment_cycles_academic_year_key" ON "recruitment_cycles"("academic_year");
CREATE INDEX "recruitment_cycles_is_active_idx" ON "recruitment_cycles"("is_active");
CREATE UNIQUE INDEX "recruitment_cycles_one_active_key" ON "recruitment_cycles"("is_active") WHERE "is_active" = true;
CREATE UNIQUE INDEX "forms_recruitment_cycle_id_key" ON "forms"("recruitment_cycle_id");
CREATE INDEX "form_fields_form_id_is_active_order_idx" ON "form_fields"("form_id", "is_active", "order");
CREATE UNIQUE INDEX "form_fields_form_id_key_key" ON "form_fields"("form_id", "key");
CREATE UNIQUE INDEX "form_fields_form_id_order_key" ON "form_fields"("form_id", "order");
CREATE UNIQUE INDEX "registration_submissions_application_number_key" ON "registration_submissions"("application_number");
CREATE INDEX "registration_submissions_recruitment_cycle_id_payment_statu_idx" ON "registration_submissions"("recruitment_cycle_id", "payment_status");
CREATE INDEX "registration_submissions_recruitment_cycle_id_decision_idx" ON "registration_submissions"("recruitment_cycle_id", "decision");
CREATE UNIQUE INDEX "registration_submissions_user_id_recruitment_cycle_id_key" ON "registration_submissions"("user_id", "recruitment_cycle_id");
CREATE INDEX "form_input_submissions_submission_id_idx" ON "form_input_submissions"("submission_id");
CREATE UNIQUE INDEX "form_input_submissions_submission_id_field_key_key" ON "form_input_submissions"("submission_id", "field_key");
CREATE UNIQUE INDEX "verification_codes_action_token_hash_key" ON "verification_codes"("action_token_hash");
CREATE INDEX "verification_codes_user_id_purpose_expires_at_idx" ON "verification_codes"("user_id", "purpose", "expires_at");
CREATE INDEX "verification_codes_normalized_email_purpose_idx" ON "verification_codes"("normalized_email", "purpose");
CREATE INDEX "recruitment_timeline_events_recruitment_cycle_id_is_visible_idx" ON "recruitment_timeline_events"("recruitment_cycle_id", "is_visible", "order");
CREATE UNIQUE INDEX "recruitment_timeline_events_recruitment_cycle_id_order_key" ON "recruitment_timeline_events"("recruitment_cycle_id", "order");
CREATE INDEX "test_slots_recruitment_cycle_id_is_visible_order_idx" ON "test_slots"("recruitment_cycle_id", "is_visible", "order");
CREATE UNIQUE INDEX "test_slots_recruitment_cycle_id_order_key" ON "test_slots"("recruitment_cycle_id", "order");
CREATE UNIQUE INDEX "test_slot_bookings_submission_id_key" ON "test_slot_bookings"("submission_id");
CREATE INDEX "test_slot_bookings_test_slot_id_idx" ON "test_slot_bookings"("test_slot_id");
CREATE INDEX "interview_slots_recruitment_cycle_id_start_time_idx" ON "interview_slots"("recruitment_cycle_id", "start_time");
CREATE UNIQUE INDEX "slot_bookings_submission_id_key" ON "slot_bookings"("submission_id");
CREATE INDEX "slot_bookings_slot_id_idx" ON "slot_bookings"("slot_id");
CREATE INDEX "audit_logs_target_entity_target_id_idx" ON "audit_logs"("target_entity", "target_id");
CREATE INDEX "audit_logs_actor_id_idx" ON "audit_logs"("actor_id");

ALTER TABLE "forms" ADD CONSTRAINT "forms_recruitment_cycle_id_fkey" FOREIGN KEY ("recruitment_cycle_id") REFERENCES "recruitment_cycles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "form_fields" ADD CONSTRAINT "form_fields_form_id_fkey" FOREIGN KEY ("form_id") REFERENCES "forms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "registration_submissions" ADD CONSTRAINT "registration_submissions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "registration_submissions" ADD CONSTRAINT "registration_submissions_recruitment_cycle_id_fkey" FOREIGN KEY ("recruitment_cycle_id") REFERENCES "recruitment_cycles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "registration_submissions" ADD CONSTRAINT "registration_submissions_form_id_fkey" FOREIGN KEY ("form_id") REFERENCES "forms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "registration_submissions" ADD CONSTRAINT "registration_submissions_decided_by_id_fkey" FOREIGN KEY ("decided_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "form_input_submissions" ADD CONSTRAINT "form_input_submissions_submission_id_fkey" FOREIGN KEY ("submission_id") REFERENCES "registration_submissions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "form_input_submissions" ADD CONSTRAINT "form_input_submissions_field_id_fkey" FOREIGN KEY ("field_id") REFERENCES "form_fields"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "verification_codes" ADD CONSTRAINT "verification_codes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "recruitment_timeline_events" ADD CONSTRAINT "recruitment_timeline_events_recruitment_cycle_id_fkey" FOREIGN KEY ("recruitment_cycle_id") REFERENCES "recruitment_cycles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "test_slots" ADD CONSTRAINT "test_slots_recruitment_cycle_id_fkey" FOREIGN KEY ("recruitment_cycle_id") REFERENCES "recruitment_cycles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "test_slot_bookings" ADD CONSTRAINT "test_slot_bookings_submission_id_fkey" FOREIGN KEY ("submission_id") REFERENCES "registration_submissions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "test_slot_bookings" ADD CONSTRAINT "test_slot_bookings_test_slot_id_fkey" FOREIGN KEY ("test_slot_id") REFERENCES "test_slots"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "interview_slots" ADD CONSTRAINT "interview_slots_recruitment_cycle_id_fkey" FOREIGN KEY ("recruitment_cycle_id") REFERENCES "recruitment_cycles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "slot_bookings" ADD CONSTRAINT "slot_bookings_submission_id_fkey" FOREIGN KEY ("submission_id") REFERENCES "registration_submissions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "slot_bookings" ADD CONSTRAINT "slot_bookings_slot_id_fkey" FOREIGN KEY ("slot_id") REFERENCES "interview_slots"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
