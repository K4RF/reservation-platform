# f0.6.0 프런트엔드 검수 인계 (#306)

2026-11-08 기준. 작업 시작 `develop`은 #305 병합 `500915e`이다.
아래는 개발자 검증 기록이며 제품 전체 승인이나 마일스톤 종료가 아니다.

## 선행 증거와 남은 범위

| 이슈 | Mock / Fixture | 격리 실제 HTTP / 브라우저 | 별도 확인 |
| --- | --- | --- | --- |
| [#299](https://github.com/K4RF/reservation-platform/issues/299) 환경·API | 실제 앱을 테스트용 데이터로 실행하는 절차 | [별도 Compose·Swagger·프록시·오류 응답·Media·Kafka](frontend-backend-integration.md) | 운영 구성·운영 데이터 검증 아님 |
| [#300](https://github.com/K4RF/reservation-platform/issues/300) Auth | 세션 경합·401·콜백 상태·복귀 | [이메일 로그인·Redis 재발급·합성 OAuth 코드 교환](frontend-authentication-flow.md) | Google Provider 실제 왕복은 제외 |
| [#301](https://github.com/K4RF/reservation-platform/issues/301) 검색·예약 | 검색 복귀·예상가·완료 GET·POST 무재생 | [실제 가용성/가격·예약 스냅샷과 검색→예약 Browser](public-exploration-booking-flow.md#격리-검색예약-검증-301) | 운영 트래픽·PG 없음 |
| [#302](https://github.com/K4RF/reservation-platform/issues/302) 본인 예약 | 응답 유실 후 양쪽 쓰기 잠금과 최신 owner GET | [목록/상세·변경/취소·소유권·요금/재고와 Browser](frontend-reservation-management-flow.md#격리-예약관리-검증-302) | 실제 네트워크 유실과 결제 환불은 미검증 |
| [#303](https://github.com/K4RF/reservation-platform/issues/303) Admin | 중복·401·지연 응답·명시적 재검토 | [역할/관리 쓰기·앨범 수명주기 HTTP, 관리 메뉴·정책 수정 Browser](frontend-admin-management-flow.md#격리-관리자-검증-303) | 브라우저 앨범 쓰기는 미실행; HTTP로 검증 |
| [#304](https://github.com/K4RF/reservation-platform/issues/304) 복구 | 타임아웃·잘못된 201·응답 유실·POST/PATCH 횟수 | [실제 충돌·격리 Redis 503 주입·다른 탭 CLOSED 후 가용성 재조회](frontend-state-recovery.md) | 운영 장애·서버 멱등성 시험 아님 |
| [#305](https://github.com/K4RF/reservation-platform/issues/305) Browser/A11y | 합성 사진·오류·긴 입력·글자 200% | [1440/390 비교, 768/320 리플로우·키보드, 실제 Media 읽기](frontend-browser-accessibility.md) | Safari/Firefox·실기기 safe-area/키보드·브라우저 줌·스크린리더 미검증 |

GitHub에서 위 이슈들의 Closed 상태를 확인했다. 테스트 증거의 범위와 이슈 상태를 혼동하지 않는다.

## 구조와 요청 점검

- `CompactSearchBar`/`SearchLayer`, `CatalogImage`/`CatalogGallery`, 공통 Error/Loading 및
  `useDetailQuery`를 재사용한다. 성공/오류에 따른 복구·저장 판정은 각 화면에 둔다.
  날짜는 `calendarDate`, 금액은 `money`, 단일 날짜 가격 읽기/쓰기는 `readRoomDailyPrice`의
  계약을 따른다. 성격이 다른 관리자 복구 경로나 역할/소유권을 공통 폼으로 합치지 않았다.
- `apiClient`의 401 읽기 재발급/재시도와 예약·관리 쓰기의 재전송 금지 경계를 유지했다.
  Booking은 404/409 뒤 새 가용성으로 기존 선택을 버리고, 5xx/유실이면 내 예약 확인 전
  같은 요청을 반복하지 않는다. 예상 가격은 저장 금액이 아니다.
- `BookingPriceSession`이 상세의 선택부터 입력·검토까지 가격 읽기를 공유한다.
  기존 `BookingCreationFlow`는 2박에 가격 GET 2건(체크아웃 제외)과 POST 1건을 확인한다.
  로그인 복귀 및 404/409의 가용성 GET은 이전 결과와 독립적으로 검증해야 하는 요청이다.
  404 뒤 객실 재선택은 가용성 GET 총 2건·가격 GET 총 4건을 기대한다.
  사진 URL은 응답에서 직접 오며 사진을 찾기 위해 카드마다 별도 상세 API를 호출하지 않는다.
  Gallery에서 같은 이미지 바이트가 캐시에서 재사용되는지는 브라우저/HTTP 정책의 영역이다.
- 현 소스·테스트·템플릿 조합을 대조해 `home-link`, `availability-guidance`,
  `room-availability`, `accommodation-info`, `reservation-detail-header`,
  `booking-accommodation`, `booking-stay-details`, `reservation-context-note` CSS만 제거했다.
  동적으로 조합하는 `auth-page-form/notice`, `booking-result-cancelled`,
  `reservation-status-*` 및 `reservation-summary-*`는 유지했다. 1440×1000과 390×844의
  Home Hero·Detail Rail·로그인 패널·예약 상세에서 전후 위치/크기/표시·가로 폭이 같았다.
  요청 코드·의존성·환경변수·CI 변경은 없다.

## 이번 실행과 원격 기준선

- Windows / Node 24.14.0 / pnpm 11.19.0: `pnpm install --frozen-lockfile`, lint, format:check,
  typecheck, test(80 suites / 1,161 tests), build 통과. 기존 Auth·Booking 생성·예약관리·
  Admin Lifecycle 4개만 먼저 실행한 결과는 50개 통과다(전체에 포함, 별도 합산하지 않음).
- 루트에서 `node scripts/integration/run.mjs --recovery` 통과. 실제 API/Media/권한/충돌 및
  Redis 503 주입 후 미저장을 다시 확인했고 이 실행의 자원만 제거했다.
  Backend 소스가 바뀌지 않아 이번 로컬 Wrapper 전체 test/build는 실행하지 않았다.
- 과거 기준: [PR #298 Frontend](https://github.com/K4RF/reservation-platform/actions/runs/42055458184) ·
  [Backend](https://github.com/K4RF/reservation-platform/actions/runs/42055458148), 병합 `e7b29e2`의
  [develop Frontend](https://github.com/K4RF/reservation-platform/actions/runs/42055996458) ·
  [Backend](https://github.com/K4RF/reservation-platform/actions/runs/42055996381) 모두 성공.
  작업 시작 `500915e`의 [develop Frontend](https://github.com/K4RF/reservation-platform/actions/runs/42485545499)도 성공.
  이들은 이번 검수 revision의 원격 결과가 아니다. 이번 SHA 및 Actions 링크는 #306 PR의 Checks를 기준으로 한다.

## 성능·부하 테스트 인계

Windows 인앱 Chromium에서 [UI Audit](../../frontend/scripts/ui-audit/README.md)의
`path=/&scenario=comparison&media=present&metrics=1`을 1440×1000과 390×844로 열었다.
로컬 개발 서버·합성 사진·캐시 미통제 단일 표본에서 Hero 인코딩 크기는
153,676 / 52,228 bytes, 마지막 관찰 LCP 후보는 756 / 284ms였다.
두 합성 PNG는 약 2.76 / 2.46MB였다. 브라우저의 전송량과 파일 크기를 혼동하지 않는다.
Layout Shift 로그가 이 표본에서 관찰되지 않은 것은 CLS=0 또는 성능 목표 달성을 뜻하지 않는다.

[v0.5.0 성능·부하 단계](https://github.com/K4RF/reservation-platform/milestone/8)에 넘길 **제안**:

1. 공개 탐색: 숙소 목록/검색→숙소·객실 상세→대표 Media 콘텐츠. 목록/상세를 분리하고
   Media 없음/있음과 응답 크기, 캐시 cold/warm 및 조회 병목을 비교한다.
2. 예약 탐색: 날짜·인원으로 가용 객실 조회→선택 객실의 `[check-in, check-out)` 가격 GET.
   2박/여러 박을 구분하고 요청 수와 p95/p99·오류율을 별도로 측정한다.
3. 예약 쓰기: 새 격리 DB/계정과 준비한 객실·날짜·재고로 POST→owner GET→취소.
   동일 객실/날짜 충돌과 서로 다른 객실을 구분하고 성공 수·점유량·락/충돌 오류를 확인한다.
   요청 성공 여부를 확인하지 않고 쓰기를 반복하거나 개발 Compose에 부하를 주지 않는다.

부하 도구 설치·SLO·운영 관측성은 이번 범위가 아니다. 브라우저 렌더링과 API 부하는 별도 측정한다.

## 최종 사용자 검수 시작

실행 명령과 화면별 동선, 사용자 승인 기준은 [최종 사용자 검수 (#307)](frontend-final-user-review.md)에 있다.

1. #306 PR의 검토 대상 SHA와 Checks를 확인한다. [화면 비교 재현표](../../frontend/scripts/ui-audit/README.md#화면-비교-재현-305)로
   1440/390의 원본과 제품을 같은 위치에서 본다. #305의 일회성 ZIP은 작업 환경의
   `.local/ui-audit-305-review.zip`에만 있으며 Git에 없다. 다른 Clone에서는 재현표를 사용한다.
2. 실제 흐름을 볼 때는 [격리 준비/정리 절차](frontend-backend-integration.md)대로 Backend JAR와
   pnpm 의존성을 준비하고, 필요 영역의 옵션(`--booking`, `--management`, `--admin`)을
   개별 실행에 선택한다. `--hold`와 마스킹 입력한 테스트 비밀번호를 사용하며 실제 비밀번호·
   토큰·대표 투숙객 정보를 캡처하지 않는다. 실패 후에는 새 GET으로 저장 여부부터 확인한다.
3. 사용자 검수에서는 데스크톱과 실제 모바일에서 사진/텍스트/키보드/고정 버튼을 확인한다.
   실제 Google은 승인된 테스트 Client/계정이 준비될 때 따로 확인한다. 남은 문제를 화면·조건·
   재현 단계와 함께 기록하고, 최종 시각 승인 및 마일스톤 종료는 별도 REVIEW에서 결정한다.
