# Frontend

Reservation Platform의 브라우저 애플리케이션입니다. `frontend/`는 React 19,
TypeScript 6, Vite 8 및 pnpm 11을 사용하는 독립 프로젝트이며, `backend/` Gradle
프로젝트와 의존성·빌드 결과를 공유하지 않습니다.

## 요구 환경

- Node.js 20.19 이상 또는 22.12 이상 (Vite 8 요구사항)
- pnpm 11.19.0 (`package.json`의 `packageManager` 버전)

## 로컬 실행

프로젝트 루트에서:

```bash
cd frontend
pnpm install --frozen-lockfile
cp .env.example .env
pnpm dev
```

Windows PowerShell에서는 `cp` 대신 `Copy-Item .env.example .env`를 사용할 수
있습니다. 개발 서버의 기본 주소는 `http://localhost:5173`입니다. 이 단계의
화면은 실행 환경을 확인하기 위한 최소 진입 화면이며 Backend API 요청은 아직 하지
않습니다. 따라서 Backend나 Docker Compose를 켜지 않아도 화면을 확인할 수 있습니다.

```bash
pnpm typecheck
pnpm build
pnpm preview
```

`build`는 TypeScript 검사 후 `dist/`에 Production 정적 파일을 생성합니다.
`preview`는 생성된 파일의 로컬 확인용이며 배포 서버가 아닙니다.

## 환경 변수와 범위

`.env.example`의 `VITE_API_BASE_URL`은 향후 API Client에서 사용할 공개 Backend
주소의 예시입니다. 현재 코드에서는 읽지 않습니다. Vite의 `VITE_` 접두사 변수는
브라우저 번들에 포함될 수 있으므로 비밀번호·토큰·비밀키를 넣지 마세요.
실제 `.env`와 `node_modules/`, `dist/`는 Git에서 제외됩니다.

현재 구현 범위는 `index.html` → `src/main.tsx` → `src/App.tsx`의 React 진입과
기본 스타일뿐입니다. 라우팅, 인증, API Client, 숙소 검색, 예약, 관리자 화면은
후속 Frontend 이슈 범위입니다.
