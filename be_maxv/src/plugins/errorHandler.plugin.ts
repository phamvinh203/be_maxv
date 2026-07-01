import fp from 'fastify-plugin';
import {
  ConflictError,
  NotFoundError,
  UnauthorizedError,
  ForbiddenError,
  ValidationError,
  MailError,
} from '../helpers/errors';
import { HttpStatus } from '../constants/httpStatus';
import { MESSAGES } from '../constants/messages';

/**
 * Fastify plugin: ánh xạ tập trung các lỗi nghiệp vụ -> HTTP status.
 * Controller chỉ cần `throw`, không cần try/catch.
 */
export default fp(
  async (app) => {
    app.setErrorHandler((err, req, reply) => {
      if (err instanceof ValidationError) {
        return reply
          .status(HttpStatus.BAD_REQUEST)
          .send({ success: false, errors: err.details });
      }
      if (err instanceof ConflictError) {
        return reply
          .status(HttpStatus.CONFLICT)
          .send({ success: false, message: err.message });
      }
      if (err instanceof NotFoundError) {
        return reply
          .status(HttpStatus.NOT_FOUND)
          .send({ success: false, message: err.message });
      }
      if (err instanceof UnauthorizedError) {
        return reply
          .status(HttpStatus.UNAUTHORIZED)
          .send({ success: false, message: err.message });
      }
      if (err instanceof ForbiddenError) {
        return reply
          .status(HttpStatus.FORBIDDEN)
          .send({ success: false, message: err.message });
      }
      if (err instanceof MailError) {
        req.log.error(err);
        return reply
          .status(HttpStatus.BAD_GATEWAY)
          .send({ success: false, message: err.message });
      }
      req.log.error(err);
      return reply
        .status(HttpStatus.INTERNAL_SERVER_ERROR)
        .send({ success: false, message: MESSAGES.COMMON.INTERNAL_ERROR });
    });
  },
  { name: 'error-handler' },
);
