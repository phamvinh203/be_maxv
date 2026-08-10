import { buildApp } from './app';
import { env } from './config/env';
import { dongCaptchaWorkers } from './services/client/hddt/traCuuGoc/captchaOcr';

async function main() {
  const app = await buildApp();

  await app.listen({ port: env.port, host: '0.0.0.0' });

  const shutdown = async () => {
    await app.close(); // kích hoạt onClose của prisma plugin
    // Worker Tesseract của luồng tải hóa đơn gốc không nằm dưới vòng đời Fastify — phải tự đóng,
    // nếu không `tsx watch` giữ lại worker của mỗi lần reload.
    await dongCaptchaWorkers();
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
