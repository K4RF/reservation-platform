# Accommodation Search 비교 화면 / #254

검증일: 2026-10-27. 기준 develop `0c2a58c`(PR #263), 브랜치 `feature/#254-accommodation-search-redesign`.
선행 #252 공통 UI/Header가 포함된 기준이다. 개발자 구현/검증 기록이며 최종 사용자 승인이 아니다.

## 참조와 구현 범위

[승인 디자인](approved-design.md), [Search Desktop](prototypes/premium-travel/screenshots/search-1440.png) /
[Mobile](prototypes/premium-travel/screenshots/search-390.png)을 확인하고 독립 index/search와 review를 Browser에서 열었다.
f0.5.2(Milestone #19)의 Search 비교 화면 범위이며 과거 f0.5.3은 같은 단계의 이전 명칭이다.

- Navy & Ivory·큰 미디어 영역/위치/숙소명/설명/상태/편의시설 정보 계층을 적용했다.
  실제 필드는 모두 기존 AccommodationResponse에 근거한다. 설명·긴 주소/이름을 자르지 않는다.
- Search 전용 `--content-catalog:80rem` 안에서 Desktop 카드 2열, 48rem 이하 카드 1열이다.
  64rem 이하에서는 사이드바를 결과 위로 옮긴다. 다른 역할별 콘텐츠 폭과 Home/Detail은 변경하지 않는다.
- 도시/날짜/인원 입력은 상단, 추가 필터는 왼쪽, 적용 조건·정렬·상태·결과/Pagination은 오른쪽에 둔다.
  사진 없는 카드도 같은 16:10 영역을 확보해 비교 계층을 유지한다.
- 넓은 화면 초기 필터는 열리고, 좁은 화면은 기존처럼 추가 조건이 있으면 열린다.
  이후 접힘은 사용자 선택이며 단순 resize/인원 편집으로 Draft나 선택을 지우지 않는다.
  URL 변경에 따른 Form 재마운트는 이전과 같이 제출 조건으로 초기화한다.
- Mobile은 시안의 Modal 대신 **네이티브 details/summary**를 유지했다. 입력/ID를 복제하지 않고
  같은 Form을 쓰며 Enter/Space·Tab·기본 Focus를 사용한다. Modal/Focus Trap/Scroll Lock이라고 보고하지 않는다.
- Page H1은 접근 가능한 기존 “숙소 검색”을 유지한다. 시안 영문 카피·가짜 카드/사진/가격은 복사하지 않았다.
  기존 날짜 정책/인원 도움말을 남겨 시안의 압축 Search Bar보다 입력부와 결과 시작 위치가 높다.

## 현재 Media/가격 계약과 미완료 범위

Backend `dto/accommodation/response/AccommodationResponse.java`와 Frontend `api/accommodation.ts`를 확인했다.
사진 URL/Media·최저 객실가·숙박 총액·통화·리뷰/평점 필드가 없다. 별도 가격 읽기/집계도 추가하지 않았다.

- 카드 미디어는 **“사진 정보 미제공”** 텍스트와 장식 SVG뿐이다. SVG는 `aria-hidden`, 실제 img/외부 요청은 없다.
  Home 브랜드 풍경이나 시안 AI 사진을 숙소 사진으로 재사용하지 않았다.
- 현재는 URL 자체가 없어 이미지 로딩/실패 흐름을 임의로 가정하지 않는다. 목록 Loading/Error/Empty는 기존 상태를 쓴다.
  v0.4.1 Media 계약 후 URL 검증·alt·후보 크기·로딩/실패·출처를 구현/검증해야 한다.
- 기본 가격 필터는 활성 객실의 기본 1박 가격 조건이며 날짜별 override/총액이 아니다.
  카드 가격·가격순 정렬·인기/추천/할인·Bed/Size/View를 발명하지 않았다.

**비교 Layout·미제공 슬롯은 구현했지만 실제 사진 표시/이미지 로딩·실패와 가격 집계 연동은 미완료/별도 범위다.**

## 유지한 상태·요청·복귀 계약

`AccommodationSearchForm`이 모든 입력을 한 native Form으로 소유한다. Result는 Page가 children으로 제공하며
Form은 결과를 조회/변경하지 않는다. Pagination은 `type=button`, Error 재시도도 기존 비-submit 버튼이다.
모바일/사이드바/정렬 위치별 중복 입력·새 전역 Store·응답 Cache·자동 제출을 추가하지 않았다.

`StayDateFields` / `GuestCountField`, FormData → 기존 parser/serializer → URL, 제출 시 page=0,
숙소·객실 편의시설 AND, 도시/지역·기간·인원·기본가·상태/가용성·size·ID/NAME·ASC/DESC를 유지한다.
검색/조건 적용/정렬 적용은 같은 전체 Draft를 명시적으로 제출한다. 정렬만의 자동 조회나 숨은 기본값 추가가 아니다.
Summary는 검증된 **제출 URL**의 지역/날짜/인원/정렬이며 현재 편집 Draft와 분리한다. 잘못된 URL은 Summary를 표시하지 않는다.
Loading/오류/빈 결과/동일 조건 GET 재시도는 Form Key를 바꾸지 않아 편집값을 유지한다.

카드 Link의 ID·일반 클릭/Modifier 구분·canonical Query·Scroll 저장을 유지했다.
기존 [#243 복귀 계약](../testing/frontend-exploration-return-context.md)의 Back/Forward/상세 복귀/새 GET 뒤 Focus 복원을 재사용한다.
투숙객/Token URL 금지·로그인 후 Availability 재조회·쓰기 무재실행/불명확 결과 잠금/권한은 바꾸지 않았다.

## 자동 검증

`frontend/`, Windows / Node 24.14.0 / pnpm 11.19.0:

```powershell
pnpm install --frozen-lockfile --offline
pnpm lint
pnpm format:check
pnpm typecheck
pnpm test
pnpm build
pnpm exec tsc -p scripts/ui-audit/tsconfig.json
node --check scripts/ui-audit/server.mjs
```

전체 **76 files / 1,092 tests** 통과. 기존 Suite를 재사용하고 4건을 추가했다.
접힌 필터의 AND/가격/정렬 일괄 제출·page 초기화, 적용 Summary와 Draft 분리, 넓은 화면 Disclosure 선택 유지,
Loading→Empty/오류 재조회 입력 유지, 사진 미발명, Grid/Token/미디어 슬롯, 격리 비교 Fixture를 검증했다.
기존 URL/History/Scroll/로그인 복귀·예약/관리자 Lifecycle 테스트를 삭제/비활성화하지 않았다.
Backend/API/의존성/Lockfile/환경변수/운영 Vite 설정/Workflow는 변경하지 않았으며 Backend 테스트는 재실행하지 않았다.

## Browser 증거와 한계

computer-use로 실제 AppRoutes/Component/CSS를 [격리 Audit](../../frontend/scripts/ui-audit/README.md)에서 렌더링했다.
새 `comparison` 시나리오는 기존 DTO 형태의 가상 4개 행과 offset Pagination만 제공한다. 실제 필터/정렬 엔진은 아니다.
쓰기 405/미지원 읽기 404/Backend 무전달을 유지하며 운영 main/build entry에 포함하지 않는다.
이 시나리오에서 7번만 기존 상세/객실 Fixture에 연결된다. 다른 ID 상세의 완전한 연결을 주장하지 않는다.

| Browser 조건 | 직접 확인한 결과 |
| --- | --- |
| 1440×1000 익명 comparison, size=2 | 문서 폭 1425, 카드 각 488px·동일 Y의 2열, 240px 필터 사이드바, 가로 넘침 없음 |
| 390×844 익명 comparison | 문서 폭 375, 343px 카드가 같은 X의 1열, 기본 필터 접힘, 가로 넘침 없음 |
| 320×844 ADMIN stress + textScale=200 | 문서 폭 305, 241px 카드, 공백 없는 긴 이름/주소/설명·열린 필터에서 가로 넘침 없음 |
| 같은 확대 조건·달력 | 표 clientWidth 173 / scrollWidth 448, tabindex=0 내부 스크롤. 방향키 이동·Escape 후 날짜 Trigger 복귀 |
| 768/1024/1440px stress + textScale=200 | 문서 폭 753/1009/1425, 글자 32px, 각각 1/2/2열, 가로 넘침 없음 |
| 390px Empty/Error/Loading | 편집 도시 부산과 제출 Summary 서울 분리, Empty에서 편집 인원 3/조회 2 유지, Error 재조회 뒤에도 Draft 유지 |

1440px 다음/이전 Pagination, 상세 복귀 후 `accommodation-link-7` Focus와 scrollY=845 복원을 확인했다.
390px 필터 Enter 열기/접기·Draft 보존·다음 Tab 정렬 이동과 Navy Focus를 확인했다.
접힌 주차/최소가 100.25 + NAME/DESC 제출 후 상세 링크 Query에 일정/2명/필터/정렬/page=0/size=2가 유지됐다.
Console error/warn은 관찰되지 않았다. Loading은 약 10초 API Timeout 이전의 상태다.

캡처: [Desktop 결과](evidence/254/search-1440.png), [Mobile 결과](evidence/254/search-390.png),
[확대 필터](evidence/254/search-filters-320-text200.png), [Empty](evidence/254/search-empty-390.png).
브라우저 기반 격리 Fixture 증거이며 실제 HTTP/DB/인증·Google/쓰기 검증은 아니다.
MemoryRouter 주소창은 초기 Query다. Native Browser History는 기존 Router 테스트와 구분한다.
`textScale=200`은 root font/rem 확대이며 Browser Zoom/OS 배율과 같지 않다. 제공된 IAB에는 Zoom 제어가 없어
실제 Zoom·실기기·다중 Browser·수동 Screen Reader 및 최종 사용자 시각 승인은 f0.6.0에 남긴다.

## CI

[선행 PR #263](https://github.com/K4RF/reservation-platform/pull/263)의 Backend/Frontend Check 성공을 확인했다(head `5f4dc4b`).
현재 #254는 미푸시로 **원격 CI 미실행**이다. 기존 CI의 frozen install/lint/format/typecheck/test/build를 로컬에서 실행했다.
CI Ubuntu·Node 24.19.0과 로컬 Windows·24.14.0은 동일 환경이 아니다. 새 서비스·Secret·의존성 없이 기존 Workflow를 유지한다.
