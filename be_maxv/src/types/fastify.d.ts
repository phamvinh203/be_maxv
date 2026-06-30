import type { PrismaClient, Role } from '../generated/sys';

// Payload JWT dùng chung (access token mang đủ context để phân quyền)
interface JwtPayload {
  userId: string;
  donViId: string | null;
  role: string;
}

declare module 'fastify' {
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
