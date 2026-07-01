import type { FastifyInstance } from 'fastify';
import { createCompany, inviteUser } from '../controllers/client/company.controller';

export async function companyRoutes(app: FastifyInstance) {
  app.post('/', createCompany);
  
  // Chỉ owner đã đăng nhập và đã có công ty mới được mời user.
  app.post('/invite', {
    preHandler: [app.authenticate, app.requireRole('OWNER')],
    handler: inviteUser,
  });
}
