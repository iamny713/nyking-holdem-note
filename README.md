# 홀덤 노트

홀덤 토너먼트 한 번을 Google Sheets `기록` 탭의 한 행으로 관리합니다. 첫 행에는 경기일, 홀덤펍 이름, 바이인 금액, 총 엔트리, 결과 등수, 받은 프라이즈를 저장합니다.

## 개발환경

Node.js 24를 사용합니다. 기존 작업공간에 있는 `.env`에는 생성한 시트 ID가 입력되어 있습니다. 새로 받은 작업공간에서는 `.env.example`을 `.env`로 복사하고 시트 URL의 `/d/`와 `/edit` 사이 ID를 입력합니다.

1. Google Cloud 프로젝트에서 Google Sheets API를 활성화합니다.
2. 서비스 계정을 만들고, 조직 정책에서 허용하는 경우 JSON 키를 프로젝트의 `credentials/sheets.json`에 저장합니다.
3. 기록용 시트를 서비스 계정 이메일에 편집자로 공유합니다. 이 권한으로 이후 앱에서 기록을 추가할 수 있습니다.
4. 다음 명령으로 의존성을 설치하고 실제 시트의 헤더를 읽어 연결을 확인합니다.

```sh
npm ci
npm run check:sheets
```

## GitHub 원격 저장소

이 작업공간의 `origin`은 `iamny713/holdem-note`로 설정되어 있습니다. 해당 이름으로 빈 비공개 저장소를 만든 뒤, 쓰기 권한이 있는 GitHub 인증 환경에서 `git push -u origin main`을 실행합니다.
