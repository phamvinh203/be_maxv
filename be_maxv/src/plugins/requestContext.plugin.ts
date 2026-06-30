import fp from 'fastify-plugin';
import { requestContext } from '../helpers/requestContext';

/**
 * Đặt context (IP) cho mỗi request vào AsyncLocalStorage ngay onRequest,
 * để writeLog (và code sâu khác) đọc được. Đăng ký SỚM để chạy trước mọi hook.
 */
export default fp(
  async (app) => {
    app.addHook('onRequest', (req, _reply, done) => {
      requestContext.enterWith({ ip: req.ip });
      done();
    });
  },
  { name: 'request-context' },
);
