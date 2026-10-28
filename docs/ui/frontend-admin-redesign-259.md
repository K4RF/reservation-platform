# Admin Management 리디자인 — #259

검증일: 2026-10-28. develop `d5c1552`(PR #268)에서
`feature/#259-admin-management-redesign` 생성. #252 공통 Control이 포함된 기준이다.
구현/검증 기록이며 사용자 최종 UI/UX 승인 기록은 아니다.

## 참조와 적용 범위

[승인 기준](approved-design.md), [시안 README](prototypes/premium-travel/README.md),
[index](prototypes/premium-travel/index.html), [review](prototypes/premium-travel/review.html)를 확인했다.
Browser에서 A1·Navy & Ivory와 비교 보드를 열었다. Admin 자체의 직접 승인 시안은 없으므로
색·여백·구분선·Control을 확장하고, 공용 탐색 화면과 다른 관리 작업의 정보 밀도를 유지했다.
f0.5.2(Milestone #19, 이전 명칭 f0.5.3) 범위이며 최종 사용자 검수는 f0.6.0이다.

- Layout: Navy 작업 공간 Header, 기존 활성 메뉴, Catalog 폭 Token의 Sidebar/Content 구성.
  좁은 화면은 자연스러운 1열 흐름과 줄바꿈 가능한 메뉴다. Sticky/고정 CTA는 추가하지 않았다.
- `AdminPageHeading`: 작업 맥락과 기존 h2/ID만 렌더하는 순수 표현 Component다.
  Auth/Query/부모 선택/API 호출/저장 Gate를 소유하지 않는다.
- 관리 홈: 기존 `adminSections`의 네 작업 링크·설명을 2열/1열로 제공한다.
  통계 조회나 가짜 Dashboard 수치 없이 기존 경로만 연결한다.
- 숙소/객실 목록: 기존 필터·정렬·페이지와 링크를 유지하며 목록 Surface/제목 계층을 통일한다.
  부모 숙소 선택과 요청 Scope/Key는 바꾸지 않았다.
- 숙소/객실 상세 및 가격/재고 대상: 조회 정보 패널을 Ivory 배경과 출처 라벨로 구분한다.
  정보 입력 Fieldset은 Navy, 운영 상태 변경은 Warning 배경·테두리로 구분한다.
  색 외에도 기존 Legend·상태 문구·작업명·확인 체크를 유지한다.
- 정책: 명시적 POST/PUT 선택·전체 입력과 기존 안내를 유지하고, 성공 결과에는
  **마지막 쓰기 결과 · 정책 조회 아님**을 명시한다. 현재 정책 GET/존재 자동 판별을 만들지 않는다.
- 가격: DEFAULT/DAILY 및 출처·ID를 기존 서버 응답대로 표시한다. DEFAULT는 오류가 아니다.
  재고: 미생성/OPEN/CLOSED를 유지하고 예약/가용 수량 열에 읽기 전용 표시를 보강한다.
- 24rem 이하에서 관리자 Content/중첩 Form 여백과 날짜/시간 Input 안쪽 여백을 줄였다.
  320px·글자 200%에서 날짜 끝부분이 잘리던 문제를 실제 렌더로 확인하고 보정했다.
  문서 Overflow를 숨기거나 글자 크기를 축소해서 해결하지 않았다.

시안과 의도적으로 다른 점: 관리 화면에 여행 사진 Hero/Gallery나 장식용 객실 사진을 추가하지 않는다.
실제 계약이 없는 Media/확장 Metadata 입력, 전체 예약, 삭제/Batch, 매출/통계 API도 추가하지 않았다.
새 카피·Admin 레이아웃을 사용자 최종 승인으로 간주하지 않는다.

## 보존한 안전 계약

[관리 통합 Flow](../testing/frontend-admin-management-flow.md),
[재고 계약](../testing/frontend-admin-inventories.md)과 관련 Page/Form/API/Test를 대조했다.

- `useAdminMutation`, API Layer, AuthProvider/ProtectedRoute, Query Parsing/Scope는 변경하지 않았다.
  페이지 단위 중복 Submit Gate, 쓰기 401 자동 재실행 금지, Pending/불명 결과 잠금을 유지한다.
- 정책은 GET 없이 작업 선택·전체 입력·동의 뒤 저장한다. 가격은 직전 성공 GET 출처에 따른
  POST/PUT만 사용하며 404/409 후 자동 전환하지 않는다. 불명 결과는 별도 검토 전 해제하지 않는다.
- 재고는 모든 쓰기 실패 뒤 새 Calendar GET 성공·별도 결과 검토·새 저장 동의가 필요하다.
  INVENTORY_006/011 자동 보정/재실행을 추가하지 않았다. INACTIVE Room은 읽기만 가능하다.
  CLOSED는 점유 해제가 아니며 예약/가용 수량과 Version은 쓰기 Body에 넣지 않는다.
- 기존 ACTIVE/INACTIVE·부모 Context·필터/정렬/페이지와 늦은 응답 무시를 유지한다.
  이 변경은 오래 열린 화면의 순차 덮어쓰기 방지나 서버 멱등성 보장을 새로 제공하지 않는다.
- 실제 API/Domain/DB/인증/토큰 보관 방식, Backend와 Compose 데이터는 변경하지 않았다.

## 자동 검증

Windows PowerShell / Node 24.14.0 / pnpm 11.19.0에서 실행했다.

| 명령 (`frontend/`) | 결과 |
| --- | --- |
| `pnpm install --frozen-lockfile --offline` | Already up to date |
| `pnpm lint` | 성공 |
| `pnpm format:check` | 성공 |
| `pnpm typecheck` | 성공 |
| `pnpm test src/pages/admin src/app/adminRoutes.test.tsx src/test/AdminManagementFlow.integration.test.tsx src/test/designTokens.test.ts` | 7 files / 216 tests 통과 |
| `pnpm test` (최종 수정 후 재실행) | 76 files / 1,100 tests 통과 |
| `pnpm build` (최종 수정 후 재실행) | 성공 |

기존 Route/숙소/재고/스타일 계약 Suite에 표현 검증을 보강했다. 새 Lifecycle Suite는 만들지 않았다.
기존 AdminManagementFlow와 세부 Suite가 저장/권한·부모/오래된 응답·정책·가격·재고 복구를 계속 검증한다.
HTTP Mock 성공은 실제 서버 권한·DB Race·Google 인증 증거가 아니다.
CSS 소스 검사는 실제 배치/포커스의 증거가 아니므로 Browser 관찰을 별도로 기록했다.

의존성·Lockfile·실행 설정·환경변수·Workflow는 변경하지 않았다.
Frontend Actions의 설치→Lint→Format→Typecheck→Test→Build 명령을 로컬에서 확인했다.
CI는 Ubuntu/Node 24.19.0/pnpm 11.19.0이므로 OS/Node Patch까지 동일한 실행은 아니다.
새 테스트는 DB/Redis/Kafka/Docker/Secret을 요구하지 않는다. Backend 변경이 없어 Backend test/build는 미실행이다.

## Browser 관찰 및 증거

읽기 전용 [UI Audit](../../frontend/scripts/ui-audit/README.md)에서 실제 AppRoutes/Component/CSS를 사용했다.
ADMIN 서명 없는 UI Hint와 가상 응답 Fixture이며 Backend Proxy는 없다.
쓰기 버튼을 제출하지 않고 날짜 선택·정책 작업 선택·입력 포커스·키보드 이동까지만 수행했다.
저장 성공/실패와 불명 결과는 위 HTTP Mock 회귀로 검증했다. 실제 Admin HTTP 실행은 아니다.

다음 9개 경로에서 실제 제목·성공 콘텐츠/Form을 확인하고 `scrollWidth <= clientWidth`를 측정했다.
가격/재고는 객실 3, 숙소 7, 2030-07-20(재고 종료일 22) Fixture다.

- `/admin`, `/admin/accommodations`, `/admin/accommodations/7`, `/admin/accommodations/new`
- `/admin/rooms?accommodationId=7`, `/admin/rooms/3?accommodationId=7`, `/admin/rooms/new?accommodationId=7`
- `/admin/prices?roomId=3&stayDate=2030-07-20`
- `/admin/inventories?roomId=3&startDate=2030-07-20&endDate=2030-07-22`

| Viewport / 글자 | 각 경로 문서 Client / Scroll | 재고 표 Client / Scroll |
| --- | --- | --- |
| 1440×1000 / 100% | 1425 / 1425 | 974 / 974 |
| 390×844 / 100% | 375 / 375 | 310 / 576 |
| 320×900 / 200% (`font-size:32px`) | 305 / 305 | 내부 가로 스크롤 유지 |

390px 재고 표의 이름 있는 Region에 포커스한 뒤 ArrowRight로 `scrollLeft=80`을 확인했다.
포커스 대상은 `날짜별 재고 Calendar`, Outline은 solid였다. 날짜 선택 버튼의 선택 표시와
CLOSED/가용3/예약2 및 미생성 행, 단일 날짜 PUT Form을 확인했다.
모바일 관리 홈의 Tab 이동으로 작업 카드 링크의 보이는 Focus Ring도 확인했다.

대표 이미지는 **전체 페이지가 아닌 Viewport 캡처**이며 가상 데이터다.

- [관리 홈 1440](evidence/259/admin-home-1440.png), [390 상단](evidence/259/admin-home-390.png), [390 작업 카드/포커스](evidence/259/admin-home-content-390.png)
- [가격 조회/입력 1440](evidence/259/price-1440.png), [정책 입력 390](evidence/259/policy-390.png)
- [재고 1440](evidence/259/inventory-1440.png), [390 표 포커스](evidence/259/inventory-390.png), [320/글자200 날짜 입력](evidence/259/inventory-text200-320.png)

`textScale=200`은 Audit의 Root 글자/rem 확대이며 Browser Native Zoom/OS 배율/실기기 확대와 같지 않다.
Native Zoom, Screen Reader 전체 검사, 다른 Browser/실기기, 모든 오류 상태의 시각 검수는 남아 있다.
실제 Backend ADMIN 권한·쓰기/복구·예약 Race, 원격 Actions, 사용자 최종 디자인 승인은 확인하지 않았다.
Push/PR은 이번 요청 범위가 아니므로 이번 브랜치 원격 CI 결과는 없다.
검증용 Browser 탭과 두 로컬 서버는 종료했다. 개발 DB/Volume은 변경하지 않았다.
