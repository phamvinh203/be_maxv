import type { FastifyRequest, FastifyReply } from 'fastify';
import { registerCompanySchema } from '../../validators/auth.validator';
import { registerCompany } from '../../services/client/company.service';
import { validateBody } from '../../utils/validate';
import { sendCreated } from '../../helpers/response';

/** POST /api/v1/companies — Step 2: register company + provision DB maxv2_<mst>_app. */
export async function createCompany(req: FastifyRequest, reply: FastifyReply) {
  const data = await registerCompany(
    validateBody(registerCompanySchema, req.body),
  );
  return sendCreated(reply, data);
}
