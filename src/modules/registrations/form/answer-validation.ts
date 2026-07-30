import { InputType } from "../../../../generated/prisma/client.js";
import { AppError } from "../../../common/errors.js";

/** The subset of FormField needed to validate and normalize a raw answer. */
export interface FieldValidationRules {
  id: string;
  key: string;
  title: string;
  type: InputType;
  required: boolean;
  enum: string | null;
  minLength: number | null;
  maxLength: number | null;
  minValue: number | null;
  maxValue: number | null;
}

function fieldError(field: FieldValidationRules, message: string): AppError {
  return new AppError("INVALID_FORM_ANSWER", 400, `${field.title}: ${message}`);
}

function splitOptions(enumValue: string | null): string[] {
  if (enumValue === null || enumValue.trim().length === 0) {
    return [];
  }
  return enumValue.split(",").map((option) => option.trim()).filter((option) => option.length > 0);
}

function toStringList(rawValue: unknown): string[] {
  if (Array.isArray(rawValue)) {
    return rawValue.map((item) => String(item).trim()).filter((item) => item.length > 0);
  }
  if (typeof rawValue === "string") {
    return rawValue
      .split(",")
      .map((item) => item.trim())
      .filter((item) => item.length > 0);
  }
  return [];
}

function isBlank(rawValue: unknown): boolean {
  if (rawValue === undefined || rawValue === null) {
    return true;
  }
  if (typeof rawValue === "string") {
    return rawValue.trim().length === 0;
  }
  if (Array.isArray(rawValue)) {
    return rawValue.length === 0;
  }
  return false;
}

/**
 * Validates one raw answer against its active field definition and returns
 * the normalized string to store in FormInputSubmission.value. Returns
 * `undefined` when the answer is a blank, optional value that should not
 * create a row (PRD §18/19: omitted optional answers are never persisted).
 */
export function validateAndNormalizeAnswer(
  field: FieldValidationRules,
  rawValue: unknown,
): string | undefined {
  const blank = isBlank(rawValue);

  if (blank) {
    if (field.required) {
      throw fieldError(field, "This field is required");
    }
    return undefined;
  }

  switch (field.type) {
    case InputType.TEXT:
    case InputType.TEXTAREA: {
      const value = String(rawValue).trim();
      checkLength(field, value);
      return value;
    }
    case InputType.EMAIL: {
      const value = String(rawValue).trim();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
        throw fieldError(field, "Must be a valid email address");
      }
      checkLength(field, value);
      return value;
    }
    case InputType.PHONE: {
      const value = String(rawValue).trim();
      checkLength(field, value);
      return value;
    }
    case InputType.NUMBER: {
      const numeric = Number(rawValue);
      if (Number.isNaN(numeric)) {
        throw fieldError(field, "Must be a number");
      }
      if (field.minValue !== null && numeric < field.minValue) {
        throw fieldError(field, `Must be at least ${field.minValue}`);
      }
      if (field.maxValue !== null && numeric > field.maxValue) {
        throw fieldError(field, `Must be at most ${field.maxValue}`);
      }
      return String(numeric);
    }
    case InputType.DATE: {
      const value = String(rawValue).trim();
      const parsed = new Date(value);
      if (Number.isNaN(parsed.getTime())) {
        throw fieldError(field, "Must be a valid date");
      }
      return value;
    }
    case InputType.SELECT: {
      const value = String(rawValue).trim();
      const options = splitOptions(field.enum);
      if (!options.includes(value)) {
        throw fieldError(field, "Must be one of the available options");
      }
      return value;
    }
    case InputType.MULTI_SELECT:
    case InputType.CHECKBOX: {
      const values = toStringList(rawValue);
      const options = splitOptions(field.enum);
      for (const value of values) {
        if (!options.includes(value)) {
          throw fieldError(field, `"${value}" is not one of the available options`);
        }
      }
      return values.join(",");
    }
    default: {
      throw fieldError(field, "Unsupported field type");
    }
  }
}

function checkLength(field: FieldValidationRules, value: string): void {
  if (field.minLength !== null && value.length < field.minLength) {
    throw fieldError(field, `Must be at least ${field.minLength} characters`);
  }
  if (field.maxLength !== null && value.length > field.maxLength) {
    throw fieldError(field, `Must be at most ${field.maxLength} characters`);
  }
}
