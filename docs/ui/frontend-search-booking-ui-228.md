# 숙소 탐색·예약 생성 UI 정돈 (#228)

## 변경 범위와 유지한 계약

2026-10-21(Asia/Tokyo), `develop`의 `6d18c56`에서
`feature/#228-search-booking-ui`를 생성했다. #225 Token과 #226 공통 UI를 재사용하며
API·인증·가격 계산·예약 상태/제출 로직은 변경하지 않았다.

| 영역 | 이번 변경 | 그대로 유지한 기준 |
| --- | --- | --- |
| Home·검색 | Home 안내 구분선, 검색 제목/가격 조건 안내/결과 수 계층, 상세 필터 구분선·fieldset 간격, Pagination 정렬 | 공개 탐색, 정확한 도시명·날짜 검증, URL 조건·페이지 복원 |
| 숙소 카드·상세 | 위치·설명·편의시설 구분, 상세 정보별 구분선, Desktop 컬럼의 최소 폭 제어 | 실제 응답 필드만 표시, 사진 미제공 장식 유지, 정책 조회 불가 안내 |
| 객실·가용성 | 기본 1박 가격 강조, 선택 Card 테두리/배경·`선택된 객실` 텍스트·pressed 버튼, 선택 요약 제목 | 새 GET 결과에서만 선택 복원, 날짜/인원/객실/페이지 변경 시 기존 초기화·늦은 응답 무시 |
| 예약 요약·입력·확인 | 요약/대표 투숙객 Form/최종 확인의 구분, 예상 합계 강조, 요금 표 내부 스크롤·안내·키보드 진입, 오류/로딩 표현 | 기존 money 유틸리티·DAILY/DEFAULT·체크아웃 제외·Backend 최종 계산, 입력 메모리 보관과 초기화 |
| 완료 | 서버 상태별 결과 표현, 저장 금액 강조, 실제 Link 두 개를 공통 action-group으로 분리 | 소유자 GET·GET만 재시도, 취소된 예약은 취소 상태, 결제 완료 아님, 원래 이동 경로 |

금액에 통화·세금·추가 수수료를 붙이거나 가격을 반올림/재계산하지 않는다.
객실 카드의 기본 가격, 조회 시점의 예상 총액, 완료 GET의 저장 Snapshot은 서로 다른 정보다.
가용성은 예약 성공 보장이 아니며 기존 Backend 재검증 문구를 유지한다.

`BookingSubmit`의 Ref 제출 잠금, pending 버튼 disabled/aria-busy, 명시적 재시도 분류,
불명 결과 뒤 잠금과 401 자동 POST Replay 금지는 수정하지 않았다. `bookingFailure`의 기존
`503 INVENTORY_013` 재시도 분류도 이번 스타일 범위에서 변경하지 않았으며, 응답 유실/서버 Commit
경계에 대한 실제 연동 확인은 별도다. 로그인 복귀 시 가용성을 다시 조회하는 경로도 그대로다.
새 예약 Route·Modal·공용 Form Library·공유 응답 Cache는 추가하지 않았다.

## 변경 파일

- `frontend/src/index.css`: 기존 Token으로 탐색/예약 영역을 정돈한다. 일반 예약관리·Admin 표의
  레이아웃은 건드리지 않고 `.booking-summary .booking-price-table`에만 표 폭/정렬을 적용한다.
- `pages/AccommodationSearchPage.tsx`, `components/accommodation/{AccommodationCard,AccommodationInfo,AccommodationList}.tsx`:
  검색 Header·상태·카드 표현 Hook과 기존 Empty 표현을 연결한다.
- `components/room/{RoomCard,RoomAvailabilitySection}.tsx`: 기존 selected 결과를 시각·텍스트로 표시한다.
- `components/booking/{BookingSummary,BookingFlow}.tsx`: 요약·입력·확인 영역과 접근 가능한 표 스크롤을 연결한다.
- `pages/BookingCompletePage.tsx`: 결과 표현과 다음 단계 Navigation을 분리한다.
- 기존 `BookingSummary`, `RoomAvailabilitySection`, `BookingCompletePage` 테스트 및
  `test/designTokens.test.ts`: 새 표현의 계약을 보강한다. 통합 Flow Suite는 중복 생성하지 않는다.

위 Page/Component/Test 경로는 `frontend/src/` 기준이다. 의존성·Lockfile·환경변수·
Vite/Backend 실행 설정·GitHub Actions Workflow 변경은 없다.

## Browser 검증과 증거

기존 [읽기 전용 Audit 도구](../../frontend/scripts/ui-audit/README.md)를 사용했다.
실제 AppRoutes/AuthProvider/CSS를 렌더링하지만 데이터와 USER 역할은 Fixture이며,
실제 Backend·DB·Redis·Google 인증을 사용하지 않는다. 쓰기는 차단되고 외부 전달도 없다.
가짜 투숙객 입력 후 **제출 전 확인까지만** 열었으며 예약 생성 버튼은 누르지 않았다.

[측정 JSON](evidence/228/measurements.json)에 22개 관찰과 18개 viewport JPEG를 남겼다.
sourceBaseCommit은 변경 전 기준이며 캡처는 이번 미커밋 UI 변경이 적용된 상태다.
캡처 크기는 scrollbar 제외/도구 축소로 설정 viewport와 다를 수 있어 폭 판단은 DOM 값을 따른다.

| 확인 | 관찰 결과 / 대표 증거 |
| --- | --- |
| Desktop 1440×1000 | [검색](evidence/228/search-desktop.jpg), [필터](evidence/228/filters-desktop.jpg), [예약 요약](evidence/228/booking-desktop.jpg), [완료](evidence/228/complete-desktop.jpg)에서 문서 가로 넘침 0 |
| Mobile 390×844 | [필터 입력](evidence/228/filters-mobile-fields.jpg), [객실 선택](evidence/228/room-selected-mobile.jpg), [확인 패널](evidence/228/booking-review-mobile.jpg)에서 문서 가로 넘침 0 |
| 요금 표 | Mobile clientWidth 275 / scrollWidth 400, Desktop 498 / 498. [키보드 스모크](evidence/228/booking-summary-mobile.jpg)에서 region 포커스와 ArrowRight 뒤 scrollLeft=39 확인. 날짜/숫자 줄바꿈 대신 표 내부에서 전체 값을 볼 수 있음 |
| #224 D02 | Desktop 두 완료 Link 사이 수평 간격 12px, 각각 높이 44px. Mobile은 같은 x에 줄바꿈하며 행 간격 12px. `/reservations` Link 클릭 후 내 예약 Heading 확인 |
| 검색 상태 | Empty 안내 DOM·disabled Pagination, [Error 구역](evidence/228/search-error-feedback-mobile.jpg), 기존 Timeout 이전 Loading status DOM 확인. 성공/취소 완료 결과는 Fixture 상태이며 실제 생성 성공이 아님 |
| 공개 진입 | Home 검색 → 날짜/인원 보존된 상세 Link → 새 가용성 결과 선택 → 로그인 Heading까지 실제 UI 조작. 실제 로그인/로그인 후 복귀는 기존 Mock 통합 테스트로 검증 |
| 768px / 320px Home | 768px clientWidth/scrollWidth=753/753. 320px는 305/320으로 기존 #224 D01의 15px 전역 넘침 재현. 이번에 숨기지 않았고 #231 횡단 수정 대상으로 유지 |

전체 Keyboard/Screen Reader·대비·Zoom·Breakpoint 조합이나 실제 단말 전체 승인이 아니다.
실제 가격 API 실패/쓰기 Race·Google OAuth2·실서버 End-to-End 및 최종 사용자 디자인 승인은
f0.6.0 범위로 남긴다. 이번 작업에서 별도 수동 검수 Issue를 만들지 않았다.

## 자동 검증·CI 검토

- 변경 중 관련 12 Suite / 91 tests 통과. 표현 검증 보강 후 관련 4 Suite / 29 tests 통과.
- `pnpm install --frozen-lockfile --offline`: Already up to date, pnpm 11.19.0.
- `pnpm lint`, `pnpm format:check`, `pnpm typecheck`: 성공.
- `pnpm test`: **71 files / 984 tests** 통과. 기존 BookingCreationFlow 및
  인증/예약관리/Admin 통합 테스트와 세부 Suite를 그대로 실행했다.
- `pnpm build`: 성공, Vite 8.3.1 / 132 modules.
- `pnpm exec tsc -p scripts/ui-audit/tsconfig.json`: 성공.

Frontend CI의 lockfile 고정 설치·lint·format·typecheck·test·build 순서와 호환되는 변경이다.
로컬은 Windows / Node 24.14.0 / pnpm 11.19.0이며 CI는 Ubuntu / Node 24.19.0이므로
동일 OS/Patch 재현은 아니다. push/PR은 요청 범위가 아니므로 **이번 브랜치의 원격 CI는 미실행**이다.
Backend 소스·설정 변경이 없어 Backend 전체 test/build도 실행하지 않았다.
