import { buildApp } from './app';
import { env } from './config/env';

async function main() {
  const app = await buildApp();

  await app.listen({ port: env.port, host: '0.0.0.0' });

  const shutdown = async () => {
    await app.close(); // kích hoạt onClose của prisma plugin
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
