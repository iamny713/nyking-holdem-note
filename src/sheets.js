import { GoogleAuth } from 'google-auth-library';

export const headers = ['경기일', '홀덤펍 이름', '바이인 금액', '총 엔트리', '결과 등수', '받은 프라이즈'];

export async function checkSheetsConnection() {
  const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
  if (!spreadsheetId || !/^[\w-]+$/.test(spreadsheetId)) {
    throw new Error('.env의 GOOGLE_SHEETS_SPREADSHEET_ID에 시트 ID를 입력하세요.');
  }

  const auth = new GoogleAuth({
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  const client = await auth.getClient();
  const range = encodeURIComponent("'기록'!A1:F1");
  const { data } = await client.request({
    url: `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}`,
    timeout: 10000,
  });
  const row = data.values?.[0] ?? [];
  if (row.length !== headers.length || !headers.every((header, index) => row[index] === header)) {
    throw new Error('기록 탭의 A1:F1 헤더가 예상한 열 구성과 다릅니다.');
  }
}
