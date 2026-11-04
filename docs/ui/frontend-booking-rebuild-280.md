# Booking 소비자 흐름 재구성 (#280)

2026-11-04 · [이슈 #280](https://github.com/K4RF/reservation-platform/issues/280) ·
기준 `develop ecb0802` (#279 / PR #293 포함).
이 기록은 구현·DOM/HTTP Mock·격리 Browser Fixture 증거다. 실제 예약/결제, 원격 CI 성공이나 사용자 최종 승인이 아니다.

## 기준과 범위

[#271 명세](prototype-rebuild.md), [승인 디자인](approved-design.md),
[원본 Detail](prototypes/premium-travel/index.html?view=detail&palette=navy),
[#279 결과](frontend-detail-rebuild-279.md)와 현재 소스/테스트를 대조했다.
Booking에는 직접 승인된 독립 원본 화면이 없다. 원본 Detail을 Browser에서 열어 Navy/Ivory·서체·사진 언어를 확인하되,
원본 Detail과 Booking의 픽셀 일치를 주장하지 않는다. 최종 UX 승인은 f0.6.0에 남긴다.

Backend/API/Auth/가격 정책/토큰 저장/Route/환경변수/의존성은 변경하지 않았다.
새 Booking Route나 저장소를 만들지 않고 같은 Detail URL과 선택 컨트롤러를 유지한다.
Guest 입력은 메모리 전용이며 화면 이탈/명시적 객실 복귀 후 다시 진입하면 초기화된다.

## 구현

- `RoomAvailabilitySection`이 선택·가용성·페이지를 계속 소유한다. 명시적 계속 후
  `RoomExplorationLayout`은 목록/Rail/Mobile 고정 CTA 대신 Booking 단계만 렌더링한다.
  Page도 이때 제목/Gallery/검색 복귀 링크를 내려놓는다. Header/Footer는 유지한다.
- `BookingPriceSession`이 선택 시점의 일별 GET을 소유한다. Rail → 입력 → 검토 → 객실 복귀에
  같은 가격 상태를 전달하여 중복 GET을 만들지 않는다. 조건/객실 변경 때는 기존 초기화 규칙을 따른다.
  로그인 허용 상태가 바뀌면 결과 컨트롤러를 새로 만들고 가용성을 다시 읽는다.
- `BookingTripSummary`는 실제 응답의 이름/정원/날짜/총 인원과 Room 대표 Media를 사용한다.
  Room Media가 없을 때만 실제 Accommodation 대표 Media를 사용하며, 로드 실패에 가상 대체 사진을 넣지 않는다.
  Media 상태는 Guest/가격/제출 상태와 독립이다. 현재 정보임을 표시한다.
- Desktop은 최대1120px 영역, 입력 최대640px, 요약360px이다. Grid의 주 열은712px이고
  Grid gap은48px이므로 입력 cap 뒤 여백72px이 추가된다. 이는 #271의 대략적 폭을 적용한 결과이며
  모든 요소가 정확히640/48/360으로 채워진 레이아웃이라고 주장하지 않는다.
  1024px 이하에서는 여행 요약 → 입력/검토 순서로 재배치한다.
- 일별 내역/기본 가격/출처는 펼쳐 볼 수 있다. 예상가와 확정 금액을 구분하고 Currency/세금/할인/옵션을 만들지 않는다.
  기존 일별 API 응답을 BigInt 단위로 합산하며, 부분 실패에 가짜 합계를 제공하지 않는다.
- 입력 오류는 첫 잘못된 필드에, 검토 진입은 검토 제목에, 수정은 이름 입력에 Focus를 보낸다.
  생성 실패는 오류에 Focus/중앙 스크롤을 제공한다. 진행 단계는 `aria-current=step`이다.
- `BookingSubmit`의 동기 Ref 잠금에 내부 객실 복귀 잠금을 연결했다. 대기/불명/성공에서는 수정·재제출·내부 복귀로
  새 제출을 열 수 없다. 확정된 도메인 거절 후에만 기존 명시적 재시도를 유지한다.
  불명 결과에는 내 예약 조회 링크를 제공하고, 검토 안내가 미생성을 단정하지 않도록 바꿨다.
  Browser 전체 이탈/새로고침을 막는 서버 멱등성은 새로 구현하지 않았다.
- 완료의 소유자 `GET /reservations/{id}`만 번호/상태/일정/인원/Guest/금액의 근거다.
  `BookingResultCatalog`의 별도 공개 Room → Accommodation GET은 현재 이름/사진용이며 Snapshot이 아님을 표시한다.
  이 조회/이미지 실패가 완료 상태나 저장 금액을 지우지 않는다. 조회 실패의 재시도도 해당 공개 GET만 반복한다.
  예약 상세/검색/내 예약으로 이동할 수 있고 결제 완료로 표현하지 않는다.

## 비교

| 항목 | 원본/변경 전 → 목표 | 실제 결과 | 남은 차이·이유 |
| --- | --- | --- | --- |
| 단계 진입 | Detail 전체 아래 긴 폼 → 입력 작업에 집중 | 변경 전 Booking 시작 documentY 약2133, 전체 높이3282. 새 Desktop 입력은 documentY 약403, 전체1243 | 별도 URL은 없음. 선택·Auth·복귀 계약 보존 |
| Desktop 구성 | #271 입력/여행 요약 분리 | 같은1120px 영역에서 입력 cap640/요약360, 실제 사진·일정·인원·예상가 표시 | 주 열의 잔여72px. 원본에 없는 새 제품 구성안 |
| Mobile 구성 | 상세 아래 폼 → 간결한 여행 요약 다음 입력 | 390px에서 요약 약428px, 입력 시작 documentY 약747, 정상 전체1487 | 요약이 첫 Viewport 대부분을 차지하지만 입력 제목도 노출. 사진80px/2박 내역 접힘. 고정 하단 폼은 만들지 않음 |
| 검토/오류 | 긴 설명·기술 용어 → 행동/안전성 중심 | Guest·일정 요약과 생성 행동 분리, 오류 Focus 및 내 예약 복구 링크 | 미확정 결과는 재시도 불가. GET 조회 뒤 새 예약 여부는 사용자가 판단 |
| 완료 | ID/debug 중심 → 공개 번호·숙박·금액·다음 행동 | 저장 금액350.25와 예상246,913.56을 구분. 현재 사진/이름은 별도 | Fixture 금액 차이는 의도된 계약 검사, 실제 가격 사례가 아님 |
| 사진 없음/실패 | 빈 큰 슬롯/가상 대체 금지 | 없으면 짧은 미제공 안내, 404면 실패 안내. 완료의 미제공 안내는 세로로 찌그러지지 않게 별도 배치 | 실제 시설 사진/추가 객실 데이터 제공은 하지 않음 |

변경 전 Desktop/원본 Detail/변경 후 입력·검토·실패·완료의 Viewport 및 full-page 캡처는
[증거 목록](evidence/280/README.md)에 있다. Mobile의 변경 전 신규 캡처는 만들지 않았다.
원본의 Studio/demo는 Audit 외부 capture CSS로 제외했고 원본 파일/CSP는 변경하지 않았다.

## Browser 관찰과 접근성

로컬 IAB, CSS Viewport 1440×900 /390×844, 보조320×568 /390×400.
대부분 client 폭은1425/375/305px이다. 일부 캡처 직후 scrollbar 유무로 client 폭이 변한다.
저장 JPG는 IAB export로1425×891/375×812 등이므로 CSS Viewport와 Raster 크기를 혼동하지 않는다.
입력/검토/완료 비교 Viewport는 `scrollY=0`, 오류390은 Focus 위치 `scrollY=676`이다.
full-page는 전체 콘텐츠 증거이며 Viewport 밀도 비교를 대체하지 않는다.

확인한 사항:

- 1440/390 입력·검토·생성 실패·완료, Media 있음/없음/404를 관찰했다.
  입력 화면 세 Media 모드는 각각 full-page도 저장했다. 완료 Media 보조 상태는 Viewport만 저장했다.
- 생성 대기와 합성500 후에 수정/제출/객실 복귀가 잠기고 내 예약 조회만 안내된다.
  성공 Fixture를 통한 검토 → 생성 → 완료 owner GET 전환도 확인했다.
- 390 검증 실패에서 이름 입력이 y253~297, 오류 세 개가 같은 화면 안에 나타났다.
  검토 Focus는 y242~272, 결과 불명 오류는 y358~485에 노출되며 덮는 CTA가 없었다.
- 320px /root 글자200%(32px)에서 문서 가로 초과0, 이름/이메일 Focus y240~328.
  요금 표는 이름/TabIndex가 있는183px 내부 영역에800px 표를 수용한다.
  키보드 Focus 진입은 확인했으나 ArrowRight 뒤 실제 scrollLeft 이동은 이 관찰에서 입증하지 못했다.
- 390×400에서 Tab으로 이메일에 이동했을 때 y267~311, 문서 가로 초과0.
  Booking에서는 고정/Sticky 요소가 없고 자연 스크롤로 입력/오류를 읽는다.
  Detail의 기존 고정 CTA를 전역 static으로 바꾼 것이 아니라, 객실 탐색과 입력 단계의 행동을 분리했다.
  탐색으로 복귀하면 ResizeObserver가 CTA 높이 관찰을 다시 연결한다.

실기기 가상 키보드/노치 safe-area/OS 확대/Browser 실제 Zoom/스크린리더 전체 탐색은 미검증이다.
root 글자 확대와 짧은 높이는 그 대체 실기기 검증이 아니다.

## 테스트·CI

기존 Lifecycle Suite를 확장했다. 테스트 삭제/disable/전체 흐름 Suite 복제는 없다.

| 명령/범위 | 결과 |
| --- | --- |
| Booking/RoomAvailability/Navigation/Creation 관련8개 Suite | 95 tests 통과(추가 최종 거절-복귀 검사는 이후 전체 실행에 포함) |
| `pnpm test` | 80 files /1,169 tests 통과 |
| `pnpm install --frozen-lockfile` | Already up to date, Lockfile 변경 없음 |
| `pnpm lint`, `pnpm typecheck`, `pnpm build` | 통과 |
| `pnpm format:check` | 초기 Audit 파일 형식 지적 후 Prettier 적용, 최종 재검사 통과 |
| `pnpm exec tsc -p scripts/ui-audit/tsconfig.json`, `node --check scripts/ui-audit/server.mjs` | 통과 |

사진 실패 후 Guest/검토/가격 유지, 내부 복귀의 대기·불명 잠금과 확정 거절 후 해제,
단일 POST/비자동401 replay/원본 검색 Query/로그인 후 fresh 가용성/History 초기화,
정확한 가격 합산/늦은 응답 무시, 완료 owner 권한/legacy/null/cancelled/공개 카탈로그 실패 독립성을 유지했다.

처음 sandbox Vitest 캐시 rename은 EPERM으로 실행되지 않아 일반 권한으로 동일 명령을 재실행했다.
실제 테스트 실패로 숨기지 않았고 테스트 설정을 바꾸지 않았다.

Frontend CI는 Node24.19.0 /pnpm11.19.0에서 같은 install/lint/format/typecheck/test/build를 실행한다.
로컬은 Node24.14.0 /pnpm11.19.0이다. 의존성/lockfile/env/workflow 변경이 없어 추가 서비스는 필요 없다.
이번에는 push/PR/원격 GitHub Actions를 실행하지 않았다. Backend test/build도 Frontend 전용 변경이라 실행하지 않았다.

Audit에는 명시적 `booking=success|ambiguous`를 추가했다. 기본 쓰기405와 무Proxy 원칙을 유지하고,
고정 POST Fixture만201/5초 후500으로 흉내 낸다. 다른 쓰기는 여전히405이며 요청 Body를 저장/반영하지 않는다.
테스트는 기본 차단과 opt-in 경계를 검사한다. 자세한 재현은 [Audit README](../../frontend/scripts/ui-audit/README.md)를 따른다.
운영 앱/Production 빌드에 이 도구를 포함하지 않는다.

## 남은 범위

- 실제 Backend/인증/Media 저장/재고 Commit/Redis/Google/네트워크 중복 생성과 최종 사용자 UX 승인은 미검증.
  개발 DB/Volume/실제 파일은 변경하지 않았다. #284의 격리 HTTP와 f0.6.0 사용자 검수로 넘긴다.
- 기존 `503 INVENTORY_013`의 직접 재시도 분류는 유지했다. Backend Commit 뒤 unlock 실패일 수도 있으므로
  미생성을 단정할 수 없는 기존 안전성 과제다. 이번 UI 재구성에서 가격/락/API 정책까지 임의 변경하지 않았다.
- 서버 멱등성, 페이지 재진입 이후 제출 이력 지속, 실제 결제/환불/취소 견적/새 정책 GET은 이번 범위가 아니다.
- Booking은 #271 새 구성안의 구현이지 독립 원본 시안의 직접 승인 결과가 아니다.
