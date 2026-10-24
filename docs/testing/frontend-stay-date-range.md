# 통합 숙박 날짜 범위 UX (#241)

## 구현과 범위

2026-10-24(Asia/Tokyo), 최신 `develop`의 `8319377`에서
`feature/#241-stay-date-range`를 생성했다. 기존 Token/공통 UI를 사용한다.
Navy & Ivory/Home A1 전면 디자인은 적용하지 않았다(f0.5.3 후속).
저장소에서 별도 시안 파일은 확인하지 못했으므로 이슈의 UX 요구와 현재 입력/조회 계약을 기준으로
아래 조작 정책을 구현했다. 최종 사용자 디자인 승인으로 간주하지 않는다.

| 소스 | 책임 |
| --- | --- |
| `components/room/StayDateFields.tsx` | 체크인/체크아웃 Label·직접 입력, 적용된 범위/박수, 보정 안내, 달력 열기/닫기·Trigger 복귀 |
| `components/room/StayDateCalendar.tsx` | 하나의 달력에서 체크인→체크아웃 선택, 별도 임시 범위, 적용/취소, 월 이동과 키보드 Grid |
| `components/room/stayDateRange.ts` | 검증된 날짜의 UTC 일/월 연산, 박수, 체크인 변경 시 최소 1박 보정 |
| `HomePage`, `AccommodationSearchForm` | 중복된 날짜 input 대신 공통 Component 사용. 이름이 있는 날짜 필드로 기존 FormData/Query Parser 재사용 |
| `RoomAvailabilitySection`, `ReservationChangeAvailabilitySection` | 기존 `StayDateFields` 사용처여서 자동 연결. 기존 `useAvailabilityForm.change/submit`와 Abort·응답 무시·결과 초기화 경로 그대로 사용 |

경로는 `frontend/src/` 기준이다. `validateAvailability`, `isCalendarDate`, Search Query Parser,
`bookingContextPath/readBookingContext`의 기존 검증/직렬화 계약은 변경하지 않았다.
Backend·API·DB·예약 가격/재고·인증 저장 구조·의존성·실행/CI 설정 변경은 없다.
관리 재고의 inclusive 날짜 범위와 단일 날짜 가격은 숙박 범위가 아니므로 교체하지 않았다.

## 선택·보정·적용 정책

- 유효한 체크인을 새로 입력/선택할 때 기존 체크아웃이 더 늦고 유효하면 유지한다.
  없거나 같거나 더 이르면 **새 체크인 + 1일**로 보정하고 날짜/이유를 안내한다.
- 직접 입력은 즉시 부모 Form 조건을 바꾸는 기존 편집 방식이다. 직접 입력한 체크아웃이
  같거나 더 이르면 몰래 다시 보정하지 않고 기존 최종 Form 검증에서 거절한다.
  Home/Search는 날짜 없는 탐색도 허용한다. 두 날짜를 지워 무날짜 검색할 수 있으며 한쪽만
  남은 값은 여전히 거절된다. 체크인만 입력하면 최소 1박 보정으로 유효한 쌍이 된다.
- 달력은 **비모달 펼침형 Panel**이다. 처음에는 체크인 선택, 이후 체크아웃 선택으로 이동한다.
  두 역할 버튼으로 다시 선택할 수 있다. 체크아웃으로 체크인 이전/같은 날을 선택하면 안내하고
  기존 임시 범위를 유지한다. 역할을 자동 뒤집거나 기존 조건을 변경하지 않는다.
- 달력에서 선택한 범위/박수는 `선택 중`이다. **날짜 적용** 전에는 부모 값·선택 객실·요금과
  조회 결과를 건드리지 않는다. 취소/닫기/Escape는 임시 선택을 버린다. 적용/취소 후 Trigger로
  Focus를 돌린다. 달력 밖 직접 입력은 임시 달력을 닫고 즉시 편집한다(취소 대상 아님).
- 달력 적용은 바뀐 날짜만 기존 `onChange`로 전달한다. 동일 범위 적용은 기존 조회를 무효화하지 않는다.
  실제 범위 변경 시 숙소 상세/예약 변경 준비의 기존 결과·객실 선택·가격/확인 상태가 제거되고
  진행 중 GET은 취소/늦은 응답 무시 대상이 된다. 새 조회는 기존 제출 버튼으로만 실행한다.
- Home/Search는 기존처럼 검색 제출 시 Query가 반영된다. Search의 미제출 Form과 URL 기반 목록은
  구별한다. Detail의 로컬 날짜 편집을 즉시 URL에 덮어쓰지 않는다. 로그인 복귀의 URL 객실 Hint는
  기존 새 Availability GET 이후 검증 규칙을 유지한다. 별도 Scroll/복귀 확장은 #243 범위다.
- 입력/표시는 `YYYY-MM-DD`, 숙박은 `[check-in, check-out)`이다. 달력의 범위 강조는 체크아웃
  경계까지 포함하지만 박수/Backend 요청은 기존 체크아웃 제외 의미다. 월·연도·윤년/DST 영향을
  피하기 위한 **UTC 날짜 연산**이지 숙소 TimeZone의 업무일·예약 마감일 계산이 아니다.
  초기 선택이 없을 때 UTC 현재 날짜는 표시 월/Focus의 Seed일 뿐이며 과거 선택을 금지하지 않는다.
  표현 범위는 기존 4자리 연도와 일치하는 `0001–9999`다. `9999-12-31` 체크인은 다음 날이
  표현 범위를 벗어나므로 체크아웃을 비우고 이른 체크인을 안내하며 적용을 막는다.

## 접근성과 정책 읽기 확장 경계

날짜 직접 입력과 Label/설명 연결은 유지한다. 달력은 이름 있는 Region·다중 선택 Grid이고
범위의 `aria-selected`, 경계 날짜의 체크인/체크아웃 이름, 역할 버튼의 `aria-pressed`를 제공한다.
Grid의 Tab 진입점은 한 날짜다. 방향키는 ±1/±7일, Home/End는 주 처음/끝,
PageUp/PageDown은 이전/다음 달의 같은 일(말일 보정), Enter/Space는 선택한다.
선택과 키보드 Focus는 별개다. 월 입력은 Enter로 부모 Form을 제출하지 않는다.
비모달이므로 Focus Trap/배경 비활성/Scroll Lock은 추가하지 않았으며 일반 Tab 이동을 허용한다.
기존 외부 disabled fieldset과 Mutation 잠금도 유지한다.

현재 정책 GET이 없어서 숙소별 Min/Max Stay/Advance Days를 추정해 날짜를 막지 않는다.
서버의 예약 정책 거절/재조회 처리를 유지하고 같은 한계를 UI에 안내한다.
v0.4.1에 정책 읽기 계약이 추가되면 부모에서 해당 숙소의 정책/TimeZone을 읽고, 범위 입력에
명시적인 제약과 출처를 전달하는 연결을 검토한다. 정책 없는 숙소·과거 행·서버 최종 검증을
구별해야 하며 이번 작업에 가짜 Policy API/Placeholder 데이터/예약 규칙은 넣지 않았다.

## 검증 결과와 한계

- 관련 6 files / **71 tests**, 전체 73 files / **1,004 tests** 통과.
  새 날짜 산술 11건, 공통 입력/달력 8건과 기존 가용성/일정 변경 Suite 보강을 포함한다.
  적용 전 선택/가격 유지·취소·적용 후 초기화·진행 중 응답 무시를 직접 입력/달력 모두 확인했다.
  기존 Home/Search 불완전 날짜 거절은 삭제하지 않고 자동 보정 뒤 체크아웃을 지운 경우로 유지했다.
  기존 Booking/로그인 복귀·취소/변경·Admin HTTP Mock 회귀도 전체 검사에 포함된다.
- `pnpm install --frozen-lockfile --offline`, `pnpm lint`, `pnpm format:check`,
  `pnpm typecheck`, `pnpm test`, `pnpm build`, `pnpm exec tsc -p scripts/ui-audit/tsconfig.json`: 성공.
  기존 Frontend CI와 같은 명령이며 로컬 Windows / Node 24.14.0 / pnpm 11.19.0이다.
  CI의 Ubuntu / Node 24.19.0과 동일 OS/Patch는 아니다. push/PR 미요청으로 원격 CI는 미실행이다.
  Backend 변경이 없어 Backend test/build는 재실행하지 않았다.
- computer-use 스킬로 실제 Browser를 확인했다. [읽기 전용 Audit](../../frontend/scripts/ui-audit/README.md)의
  실제 Route/Component/CSS와 HTTP Fixture·서명 없는 USER Hint를 사용했다.
  실제 Backend 인증/E2E·DB 검증이 아니며 예약 생성/변경/취소 쓰기는 실행하지 않았다.
- [14개 측정 기록](../ui/evidence/241/measurements.json)과 10개 viewport JPEG를 남겼다.
  [Home Desktop](../ui/evidence/241/home-calendar-desktop.jpg)·[Mobile](../ui/evidence/241/home-calendar-mobile.jpg),
  [Search Mobile](../ui/evidence/241/search-calendar-mobile.jpg),
  [Detail Desktop](../ui/evidence/241/detail-calendar-desktop.jpg)·[Mobile](../ui/evidence/241/detail-calendar-mobile.jpg),
  [일정 변경 Desktop](../ui/evidence/241/change-calendar-desktop.jpg)·[Mobile](../ui/evidence/241/change-calendar-mobile.jpg).
  실제 Enter/Space 선택, ArrowRight 월 경계/ArrowDown 이동, Escape 취소·Trigger 복귀,
  네이티브 날짜 ArrowUp의 연도 변경과 최소 1박 보정을 관찰했다.
  390/768/960/1440px 샘플은 문서 가로 넘침이 없었다. 이미지 도구의 축소/스크롤바 차이 때문에
  폭은 DOM 측정을 따르며 이미지는 전체 페이지가 아닌 현재 viewport다.
- 날짜 버튼 높이는 44px이나 390px 중첩 Form에서 폭은 약37–42px다. 전체 터치 Target/Zoom/대비/
  Screen Reader·실기기 검수와 기존 320px 전역 넘침은 #231에서 횡단 검토한다.
  실제 서버 정책 실패/지연 Race·다른 Browser·최종 사용자 UI/UX 승인은 f0.6.0 후속이다.
  #242 Stepper/#244 객실 상세 및 최종 수동 검수 Issue는 구현/생성하지 않았다.
