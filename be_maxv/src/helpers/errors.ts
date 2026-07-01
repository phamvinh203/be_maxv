import { MESSAGES } from '../constants/messages';

/** Lỗi nghiệp vụ có chủ đích (errorHandler.plugin ánh xạ -> HTTP status). */
class AppError extends Error {
  constructor(name: string, message: string) {
    super(message);
    this.name = name;
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super('ConflictError', message);
  }
}

export class NotFoundError extends AppError {
  constructor(message: string) {
    super('NotFoundError', message);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message: string) {
    super('UnauthorizedError', message);
  }
}

export class ForbiddenError extends AppError {
  constructor(message: string) {
    super('ForbiddenError', message);
  }
}

export class ValidationError extends AppError {
  constructor(public readonly details: unknown) {
    super('ValidationError', MESSAGES.COMMON.VALIDATION_FAILED);
  }
}

/** Gửi email (thông báo nghiệp vụ) thất bại — errorHandler ánh xạ -> 502. */
export class MailError extends AppError {
  constructor(message: string) {
    super('MailError', message);
  }
}
