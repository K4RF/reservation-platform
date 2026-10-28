# Read-only UI audit (#224)

현재 UI를 Browser에서 재현하는 개발 전용 도구다. 실제 AppRoutes/AuthProvider/Component/index.css와
기존 테스트 Fixture를 사용한다. CSS·업무 기능을 고치는 도구나 실제 Backend/E2E 인증 검증이 아니다.
운영 main.tsx, Vite 설정, package.json, Lockfile 및 API 코드는 바꾸지 않는다.

저장소 루트에서:

```powershell
cd frontend
pnpm install --frozen-lockfile
node scripts/ui-audit/server.mjs
```

`127.0.0.1:5174`에만 바인딩한다. Production 빌드/Preview에 이 도구를 배포하지 않는다.
실제 `.env`/개발 DB/Redis/Google 비밀값이 필요 없으며 별도 Audit 폴더만 envDir로 사용한다.
실제 Backend Proxy는 없고 앱의 fetch는 Fixture 읽기로 대체된다. 쓰기는 405 AUDIT_READ_ONLY,
미지원 API는 404를 반환하며 실제 서버로 전달하지 않는다. Google 버튼의 외부 이동/실제 OAuth2는 점검하지 않는다.

| Query     | 값                                                                |
| --------- | ----------------------------------------------------------------- |
| path      | 실제 Route와 그 Query를 URL 인코딩한 값, 기본 `/`                 |
| role      | 생략=익명, `USER`, `ADMIN`의 서명 없는 UI Hint Fixture            |
| scenario  | ready / empty / error / loading / cancelled / stress / comparison |
| textScale | 생략 또는 100 / 200. Audit 전용 root 글자·rem 확대                |
| metrics   | 생략=꺼짐 / `1`=지원되는 성능 Entry를 로컬 Console에만 기록       |

예:

- [익명 홈](http://127.0.0.1:5174/?path=%2F)
- [로그인](http://127.0.0.1:5174/?path=%2Flogin)
- [빈 검색](http://127.0.0.1:5174/?path=%2Faccommodations&scenario=empty)
- [예약 상세](http://127.0.0.1:5174/?path=%2Freservations%2F42&role=USER)
- [Admin 객실](http://127.0.0.1:5174/?path=%2Fadmin%2Frooms%2F3%3FaccommodationId%3D7&role=ADMIN)
- [Admin Calendar](http://127.0.0.1:5174/?path=%2Fadmin%2Finventories%3FroomId%3D3%26startDate%3D2030-07-20%26endDate%3D2030-07-22&role=ADMIN)

MemoryRouter를 사용하므로 내부 Link 이동은 정상 동작하지만 Browser 주소창의 path Query는
초기 진입값이다. 다른 인증/초기 상태를 재현하려면 URL을 바꾸고 새로고침한다. 영속 인증을 추가하지 않는다.
loading은 기존 apiClient의 약 10초 Timeout 이전 구간을 관찰한다. 항상 로딩인 실제 API라고 주장하지 않는다.
`stress`는 공백 없는 긴 이름·설명·이메일과 큰 요금의 가상 읽기 Fixture다. 기본/상세/가용 목록의
객실 정보와 예약 per-night/총액을 일치시킨다. 실제 데이터·Backend 최대값 전체 검증이 아니다.
`textScale=200`은 root font-size를 200%로 키워 글자/rem Reflow를 점검한다. Browser Zoom,
OS 배율이나 실기기의 글자 확대와 동일한 검증으로 보고하지 않는다. 운영 앱에는 추가하지 않는다.
`comparison`은 #254의 2열/1열 카드와 Pagination을 검증하는 숙소 4개짜리 가상 Fixture다.
검색에 `size=2`를 주면 2개씩 2페이지다. 실제 필터 동작/정렬을 수행하지 않으므로 API 의미의 증거가 아니다.
7번만 기존 상세/객실 Fixture에 연결된다. 다른 ID의 상세 연동이나 실제 매물 사진을 제공하지 않는다.
Entry/Fixture 변경 뒤 신규 시나리오를 인식하지 못하면 서버를 재시작하고 새로고침한다.
측정 시 제목/실제 Fixture 콘텐츠와 확대 글자 크기를 확인한다. 빈 페이지의 Overflow=0을 성공으로 세지 않는다.
대표 투숙객 입력은 가짜 값만 쓰고 제출 전 확인까지만 진행한다. 예약 생성/변경/취소/관리 저장은 실행하지 않는다.

도구 검증:

```powershell
pnpm exec tsc -p scripts/ui-audit/tsconfig.json
node --check scripts/ui-audit/server.mjs
pnpm test src/test/uiAuditFixtures.test.ts
```

기존 Frontend lint/format:check/typecheck/test/build도 유지한다. Browser 캡처는 CI 필수 단계가 아니다.
도구를 끌 때 실행 터미널에서 Ctrl+C를 사용한다.

## 선택형 성능 관찰 (#260)

Home URL에 `&metrics=1`을 붙이면 `UI_AUDIT_PERFORMANCE` Console 로그를 출력한다.
PerformanceObserver가 지원하는 layout-shift, largest-contentful-paint 및 img Resource만
buffered 관찰한다. `pagehide`/HMR dispose에서 Observer를 해제한다.
미지원 Browser는 supported 목록이 비어 있을 수 있으며 측정 성공/0점으로 해석하지 않는다.

로그는 시간·크기·이동값·hadRecentInput 등 수치만 포함한다. URL/ID/Element/Shift Source,
API 응답/투숙객/Token을 기록하지 않으며 요청·Storage·DOM 변경·외부 전송은 없다.
이 모듈은 Audit Entry에서만 사용하고 Production main/빌드에는 포함하지 않는다.

각 Entry는 관찰 샘플이지 표준 CLS Session Window 집계, 확정된 최종 LCP, Lighthouse 점수나
API SLO가 아니다. 경로/Viewport/캐시/개발 서버/관찰 구간을 함께 기록한다.
Resize와 입력 직후의 이동을 초기 로딩 이동으로 합산하지 말고 hadRecentInput을 구분한다.
Resource body size=0은 실제 파일이 0바이트라는 뜻이 아니다. 캐시/재검증 영향을 구분하고
전송량을 파일 크기와 혼동하지 않는다. 관찰 없는 항목은 미관측으로 남긴다.

결과·전체 Route·미확인 범위·개선 제안은 [Audit 보고서](../../../docs/ui/frontend-ui-audit-224.md),
실제 측정과 대표 이미지는 [증거 원본](../../../docs/ui/evidence/224/measurements.json)을 따른다.
