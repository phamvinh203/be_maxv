import { sendApprovedToEmployee } from '../services/shared/mailer.service';

async function main() {
  const to = process.argv[2];
  if (!to) {
    console.error('Dùng: npm run mail:test -- <email nhận>');
    process.exit(1);
  }
  await sendApprovedToEmployee({
    email: to,
    companyName: 'Công ty demo',
    tempPassword: 'Test1234',
    loginUrl: 'http://localhost:5173/login',
  });
  console.log('Đã gửi email thử tới', to);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
