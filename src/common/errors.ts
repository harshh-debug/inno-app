export class AppError extends Error {
  constructor(
    public readonly code: string,
    public readonly httpStatus: number,
    message: string,
    options?: { cause?: unknown },
  ) {
    super(message, options);
    this.name = "AppError";
  }
}
