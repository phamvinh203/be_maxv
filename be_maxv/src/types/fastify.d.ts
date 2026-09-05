import type { PrismaClient, Role } from '../generated/sys';

// Payload JWT dùng chung (access token mang đủ context để phân quyền)
interface JwtPayload {
  userId: string;
  donViId: string | null;
  role: string;
  // Bản token — xem TokenPayload ở helpers/authTokens.ts.
  tokenVersion: number;
}

declare module 'fastify' {
  interface FastifyContextConfig {
    /**
     * Cho phép MỘT route trong nhóm đã gắn guard chạy mà không cần đăng nhập.
     * Chỉ dùng cho endpoint mà trình duyệt đi vào từ site khác (redirect OAuth) — khi đó
     * cookie access (SameSite=Strict) không được gửi kèm, nên guard chắc chắn chặn nhầm.
     * Route bật cờ này PHẢI tự xác thực bằng cách khác (vd `state` ký HMAC).
     */
    khongCanAuth?: boolean;
  }

  interface FastifyInstance {
    sysPrisma: PrismaClient;
    authenticate: (req: FastifyRequest) => Promise<void>;
    requireRole: (...roles: Role[]) => (req: FastifyRequest) => Promise<void>;
  }

  // Decorator của namespace 'refresh' (@fastify/jwt) — khai báo tường minh
  // cho khớp hành vi runtime (async, đọc token từ cookie/header của request).
  interface FastifyReply {
    refreshJwtSign(
      payload: JwtPayload,
      options?: { expiresIn?: string | number },
    ): Promise<string>;
  }

  interface FastifyRequest {
    refreshJwtVerify(): Promise<JwtPayload>;
  }
}

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: JwtPayload; // dữ liệu khi ký token
    user: JwtPayload; // request.user sau khi verify
  }
}
