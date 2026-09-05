import fp from 'fastify-plugin';
import {
  ConflictError,
  NotFoundError,
  UnauthorizedError,
  ForbiddenError,
  ValidationError,
  MailError,
  DriveApiError,
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
       * Google Drive hỏng hoặc cấu hình phía mình sai (chưa bật Drive API, hết hạn mức...).
       * Không map thì rơi xuống 500 "Lỗi máy chủ nội bộ" — người dùng không biết là do dịch vụ
       * ngoài, còn mình thì tưởng app tự vỡ.
       *
       * Chỉ trả thông điệp chung, KHÔNG đẩy `err.message` ra client: nội dung Google trả về là
       * tiếng Anh kèm mã lỗi nội bộ, vô nghĩa với người nhập liệu. Chi tiết đầy đủ nằm ở log
       * cho người vận hành. Các trường hợp người dùng TỰ xử lý được (token bị thu hồi -> kết
       * nối lại, file đã xóa trên Drive) đã được đổi thành lỗi nghiệp vụ riêng ở tầng service
       * nên không đi tới đây.
       */
      if (err instanceof DriveApiError) {
        req.log.error(err);
        return reply.status(HttpStatus.BAD_GATEWAY).send({
          success: false,
          // status 0 = chưa nhận được phản hồi nào (mất mạng/DNS/tường lửa) — nói đúng như vậy,
          // đừng để người dùng đi kiểm tra cấu hình Google trong khi lỗi nằm ở đường truyền.
          message:
            err.status === 0
              ? MESSAGES.HRM.DRIVE_KHONG_KET_NOI_DUOC
              : MESSAGES.HRM.DRIVE_LOI_GOOGLE,
        });
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
          return reply.status(HttpStatus.CONFLICT).send({
            success: false,
            message: MESSAGES.COMMON.STILL_REFERENCED,
          });
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
