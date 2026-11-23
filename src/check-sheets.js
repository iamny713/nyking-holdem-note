import { checkSheetsConnection } from './sheets.js';

try {
  await checkSheetsConnection();
  console.log('Google Sheets 연결 확인 완료 (기록!A1:F1).');
} catch (error) {
  const message = error.response?.data?.error?.message ?? error.message;
  console.error('Google Sheets 연결 확인 실패:', message);
  process.exitCode = 1;
}
