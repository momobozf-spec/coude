export class AppError extends Error {
  readonly status: number;
  readonly code: string;
  constructor(message: string, status = 500, code = "INTERNAL_ERROR") {
    super(message);
    this.name = "AppError";
    this.status = status;
    this.code = code;
  }
}

export class ValidationError extends AppError {
  readonly issues: string[];
  constructor(message: string, issues: string[] = []) {
    super(message, 400, "VALIDATION_ERROR");
    this.name = "ValidationError";
    this.issues = issues;
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = "Authentication required") {
    super(message, 401, "UNAUTHORIZED");
    this.name = "UnauthorizedError";
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "You do not have access to this resource") {
    super(message, 403, "FORBIDDEN");
    this.name = "ForbiddenError";
  }
}

export class NotFoundError extends AppError {
  constructor(entity = "Resource") {
    super(`${entity} not found`, 404, "NOT_FOUND");
    this.name = "NotFoundError";
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super(message, 409, "CONFLICT");
    this.name = "ConflictError";
  }
}

/** Convert unknown thrown values into a safe, user-presentable message. */
export function toSafeErrorMessage(err: unknown): string {
  if (err instanceof AppError) return err.message;
  if (err instanceof Error && process.env["NODE_ENV"] !== "production") return err.message;
  return "Something went wrong. Please try again.";
}
