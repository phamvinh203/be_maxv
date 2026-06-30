import type { FastifyInstance } from 'fastify';
import { createCompany } from '../controllers/company.controller';

export async function companyRoutes(app: FastifyInstance) {
  app.post('/', createCompany);
}
