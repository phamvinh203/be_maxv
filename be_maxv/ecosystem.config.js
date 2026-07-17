// Cấu hình PM2 cho be_maxv trên Windows Server.
//   pm2 start ecosystem.config.js && pm2 save
module.exports = {
  apps: [
    {
      name: 'be_maxv',
      script: 'dist/server.js',

      // BẮT BUỘC đúng tuyệt đối: provisioning tenant chạy `npx prisma db push` với
      // đường dẫn TƯƠNG ĐỐI 'prisma/tenant/schema.prisma' tính từ cwd này
      // (xem src/services/shared/provisioning.service.ts). Sai cwd -> tạo công ty FAIL.
      cwd: 'E:\\maxv_v1\\be_maxv\\be_maxv',

      // Giữ 1 instance: nhiều tiến trình có thể cùng provision 1 tenant (saga chưa có khoá).
      instances: 1,
      exec_mode: 'fork',

      env: {
        // Phải set Ở ĐÂY, không phải trong file .env — src/config/env.ts đọc NODE_ENV
        // TRƯỚC khi dotenv nạp file để quyết định nạp .env.production hay .env.local.
        NODE_ENV: 'production',

        // Chromium cho puppeteer (xuất PDF). PM2 service chạy dưới LOCAL SYSTEM nên
        // không thấy %USERPROFILE%\.cache\puppeteer của tài khoản cài đặt.
        PUPPETEER_CACHE_DIR: 'E:\\maxv_v1\\be_maxv\\puppeteer-cache',

        // Cùng lý do LOCAL SYSTEM như trên: PM2 thừa hưởng %TEMP% trỏ vào
        // C:\Users\<người cài>\AppData\Local\Temp, mà SYSTEM đụng vào đó thì EPERM.
        // `npx prisma db push` lúc provisioning nạp @prisma/fetch-engine -> temp-dir
        // -> os.tmpdir() -> %TEMP%, nên tạo công ty chết ở bước đẩy schema.
        TMP: 'E:\\maxv_v1\\be_maxv\\tmp',
        TEMP: 'E:\\maxv_v1\\be_maxv\\tmp',
      },

      max_memory_restart: '1G',
      error_file: 'E:\\maxv_v1\\be_maxv\\logs\\be_maxv-err.log',
      out_file: 'E:\\maxv_v1\\be_maxv\\logs\\be_maxv-out.log',
      time: true,
    },
  ],
};
