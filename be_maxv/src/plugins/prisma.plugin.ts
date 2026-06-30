import fp from 'fastify-plugin';
import { sysPrisma } from '../config/db.sys';
import { disconnectAllTenants } from '../helpers/tenantClient';

/**
 * Fastify plugin: kết nối control plane, decorate app.sysPrisma,
 * và đóng kết nối (sys + tenant pools) khi server tắt.
 */
export default fp(
  async (app) => {
    await sysPrisma.$connect();
    app.decorate('sysPrisma', sysPrisma);

    app.addHook('onClose', async () => {
      await sysPrisma.$disconnect();
      await disconnectAllTenants();
    });
  },
  { name: 'prisma' },
);
