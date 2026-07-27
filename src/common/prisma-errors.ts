export interface PrismaErrorLike {
  code?: string;
}

export function isPrismaUniqueConstraintError(error: unknown): error is PrismaErrorLike {
  return typeof error === "object" && error !== null && "code" in error && (error as PrismaErrorLike).code === "P2002";
}
