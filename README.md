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

이 프로젝트의 원격 저장소는 [iamny713/nyking-holdem-note](https://github.com/iamny713/nyking-holdem-note)입니다. `main`은 `origin/main`을 추적합니다.

## GitHub Pages

배포 파일은 `docs/`에 있습니다. 저장소의 **Settings → Pages → Build and deployment**에서 **Deploy from a branch**, **main**, **/docs**를 선택하고 저장합니다.

기본 화면의 기록은 현재 브라우저에 저장됩니다. **예시 보기**는 별도의 체험 모드입니다. 기존 Google Sheets 연결 확인 스크립트는 로컬에서 사용할 수 있으며, 공개 페이지에서 Sheets로 동기화하려면 별도의 사용자 인증 설정이 필요합니다.

### 배포 화면에서 시트 기록 읽기

Google Cloud 프로젝트에서 Google Sheets API를 활성화합니다. OAuth 웹 애플리케이션 클라이언트를 만들고 승인된 JavaScript 원본에 `https://iamny713.github.io`를 추가합니다. OAuth 동의 화면이 테스트 상태라면 사용할 Google 계정을 테스트 사용자로 등록합니다.

배포 화면에서 **Google 스프레드시트 연결**을 열고 웹 클라이언트 ID를 입력한 뒤 Google로 로그인합니다. 로그인 계정에는 기존 시트에 대한 읽기 권한이 있어야 합니다. 시트 보기와 브라우저 기록은 각각 전환할 수 있습니다.
