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
실제 Backend Proxy는 없고 앱의 fetch는 Fixture로 대체된다. 기본 쓰기는 405 AUDIT_READ_ONLY,
미지원 API는 404를 반환하며 실제 서버로 전달하지 않는다. Google 버튼의 외부 이동/실제 OAuth2는 점검하지 않는다.

| Query     | 값                                                                                    |
| --------- | ------------------------------------------------------------------------------------- |
| path      | 실제 Route와 그 Query를 URL 인코딩한 값, 기본 `/`                                     |
| role      | 생략=익명, `USER`, `ADMIN`의 서명 없는 UI Hint Fixture                                |
| scenario  | ready / empty / error / loading / cancelled / stress / comparison                     |
| textScale | 생략 또는 100 / 200. Audit 전용 root 글자·rem 확대                                    |
| metrics   | 생략=꺼짐 / `1`=지원되는 성능 Entry를 로컬 Console에만 기록                           |
| media     | missing(기본) / present / failed / partial. 격리된 사진 상태                          |
| hero      | 생략=정상 / failed=장식용 Home WebP에만 Audit 서버가404 반환                          |
| booking   | blocked(기본) / success / ambiguous. #280 전용 합성 POST 결과                         |
| auth      | blocked(기본) / signup-success / login-error / callback-pending / callback-error      |
| admin     | blocked(기본) / policy-success / policy-error. `role=ADMIN`에서만 합성 예약 정책 POST |

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
status가 없으면 `size=2`에 2개씩 2페이지다. #278은 요청의 status만 반영하여 ACTIVE 3개,
INACTIVE 1개를 구분한다. 다른 필터/정렬은 수행하지 않으므로 API 의미의 증거가 아니다.
7번만 기존 상세/객실 Fixture에 연결된다. 다른 ID의 상세 연동이나 실제 매물 사진을 제공하지 않는다.
Entry/Fixture 변경 뒤 신규 시나리오를 인식하지 못하면 서버를 재시작하고 새로고침한다.
#277의 `comparison&media=present`는 첫 두 숙소의 대표 사진을 서로 다른 가상
콘셉트로 투영합니다. `partial`은 두 번째 사진만404입니다. `hero=failed`는
이 Audit 서버의 Referer Query에만 적용하며 Production 코드/환경변수/API를 바꾸지 않습니다.
`/__reference/index.html?view=a1&palette=navy`는 원본 HTML/CSS/JS/이미지를 allowlist로
읽어 제공하며 외부 `capture.css`로 `.studio`, `.demo-note`, `.state-demo`만 숨깁니다.
원본 파일·CSP·시안 Layout을 수정하지 않고 검토 도구바 없는 동일 시작 위치를 촬영합니다.
Production 빌드에는 포함되지 않습니다. 원본의 가상 금액/매물은 여전히 비교 자료일 뿐입니다.
측정 시 제목/실제 Fixture 콘텐츠와 확대 글자 크기를 확인한다. 빈 페이지의 Overflow=0을 성공으로 세지 않는다.
대표 투숙객 입력은 가짜 값만 쓴다. 기본은 제출 전 확인까지만 진행하며 실제 예약/변경/취소/관리 저장은 실행하지 않는다.

#280의 명시적 `booking=success`는 **오직 POST /api/v1/reservations**에 고정된 42번 Fixture/201을 반환한다.
`booking=ambiguous`는 같은 경로에서 5초 대기 후 합성500을 반환하여 대기/결과 불명 잠금을 관찰한다.
요청 Body를 보관/반영하지 않으며 입력한 이름·날짜와 응답이 다를 수 있다. 이후 완료 GET도 고정 Fixture다.
다른 쓰기는 이 옵션에서도405이며 기본 차단과 무Proxy 원칙은 유지한다. 실제 HTTP/재고/Commit 증거가 아니다.
로컬 서버 재시작 뒤 Query를 지정하고 새로고침한다. 이 도구의 옵션을 제품 코드·환경변수에 옮기지 않는다.

#282의 `auth=signup-success`는 Signup 요청 없이 `/login` Router 완료 상태와 가상 숙소 복귀를 연다.
`path=%2Flogin&auth=login-error`에서 테스트 전용 이메일/비밀번호를 입력하면 로그인 POST에만 합성 `401 AUTH_003`을 반환한다.
`auth=callback-pending`/`callback-error`는 가상 state/코드/복귀 경로로 Callback을 시작하며 코드 교환 POST에만
대기(클라이언트 Timeout 이전) 또는 합성 401을 제공한다. 실제 계정 생성, Google 이동, Token 발급은 없다.
코드 교환 직후 Callback의 URL 정리로 Audit Query가 사라질 수 있으므로 다시 보려면 원래 Audit URL로 이동한다.
모든 옵션은 이 로컬 도구에서만 적용되며 요청 내용은 저장하거나 외부로 보내지 않는다.

#283의 `role=ADMIN&admin=policy-success|policy-error`는 `POST /api/v1/accommodations/7/booking-policy`에만
고정 201 응답 또는 결과 불명 500을 반환한다. 입력값이나 가상 카탈로그를 저장/수정하지 않는다.
정책 GET, PUT, 사진 업로드·삭제 및 다른 관리자 쓰기를 활성화하지 않는다. `scenario=stress`의 재고 조회는
기존 날짜와 OPEN/CLOSED 및 예약 수량을 보존하며 큰 총수량·가용 수량을 표시해 표 스크롤을 점검한다.

도구 검증:

#276의 `media=present`는 승인 시안의 AI 콘셉트 PNG를 **이 Audit 서버에서만**
가상 catalog의 `/api/v1/media/2001/content`, `/2002/content`로 제공합니다.
Production API나 개발 DB/storage에 등록하지 않습니다. `failed`/`partial`의
2998/2999는 의도적인 파일404입니다. `scenario=stress`는 긴 alt도 검증합니다.
ADMIN album GET/ETag는 fixture이며 모든 Media 쓰기도 여전히405로 차단합니다.
실제 업로드 검증은 [#276 보고서](../../../docs/ui/frontend-media-integration-276.md)와 구분합니다.

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
