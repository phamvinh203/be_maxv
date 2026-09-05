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
// Hai client sinh ra (sys + tenant) dùng CHUNG một lớp lỗi runtime (đã kiểm chứng bằng
// so sánh tham chiếu), nên `instanceof` ở đây bắt được lỗi từ cả hai.
import { Prisma } from '../generated/tenant';

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
      /**
       * Lỗi ràng buộc của Postgres do Prisma ném ra. Không map thì rơi xuống nhánh 500 bên
       * dưới: client không phân biệt được "bấm lưu lại đi" với "máy chủ hỏng", còn log lỗi
       * thì đầy những dòng không phải sự cố thật.
       *
       * Ba mã hay gặp nhất ở luồng CRUD: trùng khóa khi hai người tạo cùng lúc (P2002),
       * bản ghi bị người khác xóa mất giữa lúc kiểm tra và lúc ghi (P2025), và xóa thứ đang
       * được nơi khác tham chiếu (P2003).
       */
      if (err instanceof Prisma.PrismaClientKnownRequestError) {
        if (err.code === 'P2002') {
          return reply
            .status(HttpStatus.CONFLICT)
            .send({ success: false, message: MESSAGES.COMMON.DUPLICATE_KEY });
        }
        if (err.code === 'P2025') {
          return reply
            .status(HttpStatus.NOT_FOUND)
            .send({ success: false, message: MESSAGES.COMMON.RECORD_GONE });
        }
        if (err.code === 'P2003') {
          return reply
            .status(HttpStatus.CONFLICT)
            .send({ success: false, message: MESSAGES.COMMON.STILL_REFERENCED });
        }
      }

      req.log.error(err);
      return reply
        .status(HttpStatus.INTERNAL_SERVER_ERROR)
        .send({ success: false, message: MESSAGES.COMMON.INTERNAL_ERROR });
    });
  },
  { name: 'error-handler' },
);
