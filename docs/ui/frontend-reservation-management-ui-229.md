# Reservation Management UI 정돈 (#229)

## 적용 범위

2026-10-21(Asia/Tokyo), `develop`의 `9ed9d31`에서
`feature/#229-reservation-management-ui`를 생성했다. #225 Token·#226 공통 UI를 재사용해
본인 예약 목록/상세·일정 변경·취소 확인의 정보 계층을 정리했다.
**API·인증·예약/가격/재고 정책·Mutation State와 실패 분류는 변경하지 않았다.**

| 화면 / Component | 표현 변경 | 유지한 계약 |
| --- | --- | --- |
| `MyReservationsPage`, `ReservationCard` | 제목·결과 수·안내 구분, 상태별 Card 경계와 기존 텍스트 Badge, 예약 번호·날짜·저장 총액 강조, Pagination·상세 Link 간격 | 본인 목록·서버 ID·UTC/날짜 원문, 현재 Catalog 이름과 저장 Snapshot 구분, 결제/환불 완료 아님 |
| `ReservationDetailPage`, `ReservationSnapshots` | 저장된 투숙객/일별 요금/정책/결과의 기존 Section 유지, 금액 표 내부 스크롤, 변경/취소 fieldset에 이름 부여 | null/과거 데이터 fallback, 현재 가격으로 저장 금액 재계산 금지, 기존 disabled 상호 배제 |
| `ReservationChangeAvailabilitySection`, `ReservationChangeConfirmation` | 날짜 Form 입력/조회 버튼 하단 정렬, 기존/새 일정 구분, 일반 가용성 참고 결과와 확정 단계 분리, 참고 요금 표·예상 총액 강조 | 객실/인원 고정, 입력 변경 시 상태 초기화·늦은 응답 무시, 일반 가용성 포함/미포함만으로 변경 성공/실패 판단 금지 |
| `ReservationCancellationSummary`, `ReservationCancellationSection` | 저장 정책의 구간/마감 구분, 사전 금액 미제공 안내 강조, 취소 확인 경계 구분 | 저장 상대 기준/비율만 표시, Browser 시간·현재 숙소 정책으로 취소 가능 여부/수수료 계산 금지, 열 때 새 owner GET |
| `ReservationCancellationSubmit`, `ReservationCancellationFeedback` | 별도 동의·위험 안내·기존 danger-action 구분, 서버 처리 결과의 수수료/예상 환불액 강조 | 실제 결제 취소/환불 완료 아님, `refundAmount`와 `estimatedRefundAmount`의 서로 다른 응답 계약 유지 |
| `index.css` | 예약 전용 Class와 기존 Token으로 Error/Loading/안내·성공 결과·표·간격 정리 | Native disabled/aria-busy/alert/status와 공통 Focus 유지, 숨김이나 클릭 차단 CSS로 잠금 대체 금지 |

위 Page/Component 경로는 `frontend/src/pages/`, `frontend/src/components/reservation/` 기준이다.
새 Library/Modal/Route/업무 API는 추가하지 않았다. 통화·세금·추가 요금도 추정하지 않는다.
표의 날짜·금액을 임의로 줄이거나 반올림하지 않고, 좁은 화면에서는 표만 가로 스크롤한다.
스크롤 영역에는 이름·안내 연결·tabIndex를 제공하고 기존 table/caption/행·열 Header를 유지한다.

## 제출·복구 경계

- 변경/취소의 기존 Ref 제출 잠금·session/Abort 검증·부모 fieldset 상호 배제를 유지한다.
  동의나 확인 패널 열기 자체는 Mutation이 아니다.
- 일정 변경은 기존 명시적 동의와 참고 요금 조회 조건을 유지한다. 불명 결과는 재전송을
  잠그고 상세 GET으로 안내한다. 확실한 도메인 거절과 불명 결과의 기존 분류를 합치지 않는다.
- 취소는 모든 실패 후 닫기/재제출 잠금을 유지한다. 새 상세 GET과 새로운 확인을 거쳐야 한다.
  401을 포함해 변경/취소 PATCH를 자동 재전송하지 않는다.
- 작업 성공은 서버 응답의 확정값을 보여 주고 기존 상세 재조회를 실행한다. 조회 실패로
  성공 응답을 취소하거나 Mutation을 다시 보내지 않는다. 목록은 재마운트 시 조회한다.
- 취소 전 Preview API는 없고 금액 미제공 안내를 유지한다. CANCELLED 재조회에는 저장 결과만
  표시하며 다시 취소하거나 변경하는 Action을 만들지 않는다.

## 검증

### 자동 테스트 / CI 검토

- 기존 예약관리 세부 Suite와 `ReservationManagementFlow.integration.test.tsx`를 재사용했다.
  같은 Flow를 다시 만드는 테스트 파일은 추가하지 않았다.
- 기존 `ReservationList` 테스트에 상태별 Card 표현과 time 원문을, 상세/변경 확인 테스트에
  표 스크롤 영역과 fieldset 이름을 보강했다. `designTokens.test.ts`에는 예약 전용 표/경고/결과
  스타일의 소스 계약을 추가했다. jsdom 검증은 실제 Pixel/Screen Reader 검증이 아니다.
- 최종 관련 **9 files / 147 tests**, 전체 **71 files / 981 tests** 통과.
  기존 변경/취소의 중복 제출, 실패 후 잠금/GET 복구, 상호 배제, 401 무재전송,
  성공 후 재조회와 전체 예약 Lifecycle 검증을 포함한다.
- `pnpm install --frozen-lockfile --offline`: Already up to date (pnpm 11.19.0).
- `pnpm lint`, `pnpm format:check`, `pnpm typecheck`, `pnpm test`, `pnpm build`: 성공.
  Vite 8.3.1 / 132 modules. `pnpm exec tsc -p scripts/ui-audit/tsconfig.json`도 성공.
- 의존성·Lockfile·환경변수·실행 설정·CI Workflow 변경 없음. Frontend CI와 같은 검사 명령을
  로컬 Windows / Node 24.14.0 / pnpm 11.19.0에서 실행했다. CI의 Ubuntu / Node 24.19.0과
  동일한 OS/Patch 검증은 아니다. push/PR은 요청하지 않아 **이번 브랜치 원격 CI는 미실행**이다.
- Backend 소스·설정·Schema 변경이 없어 이번 작업의 Backend 전체 test/build는 실행하지 않았다.

### 실제 Browser / Fixture 관찰

`computer-use` 스킬에 따라 실제 Browser 렌더링을 확인했다. 기존
[읽기 전용 Audit](../../frontend/scripts/ui-audit/README.md)의 실제 Route/Component/CSS와
Fixture/서명 없는 USER Hint를 사용했다. Backend/DB/실제 인증을 사용한 E2E가 아니다.
쓰기 차단은 유지했고, 확인 패널과 Checkbox까지만 조작했다. **최종 변경·취소 버튼은 누르지 않았다.**

[20개 측정 기록](evidence/229/measurements.json)과 16개 viewport JPEG를 남겼다.
sourceBaseCommit은 변경 전 기준이며 캡처는 이번 UI 변경이 적용된 작업 트리 상태다.
스크롤바 제외/도구 축소로 이미지 크기가 설정 viewport와 다를 수 있어 DOM 측정값을 따른다.

| 관찰 | 확인 결과 / 대표 증거 |
| --- | --- |
| 목록 | [Desktop](evidence/229/list-desktop.jpg)·[Mobile](evidence/229/list-mobile.jpg)에서 상태 텍스트, 번호/날짜/금액과 현재 Catalog 안내 확인 |
| 저장 요금 | [Mobile 표](evidence/229/saved-prices-mobile.jpg) clientWidth 309 / scrollWidth 384. tabIndex=0 영역에 포커스한 뒤 ArrowRight 후 focus/scrollLeft=23 확인. Desktop 표는 894/894 |
| 변경 준비·확인 | Native 날짜 키 입력으로 2031-01-01~2031-01-03을 확인하고 가용성 재조회·확인 패널을 열었다. [Mobile](evidence/229/change-confirm-mobile.jpg)·[Desktop](evidence/229/change-confirm-desktop.jpg). Desktop 날짜 입력/조회 버튼은 모두 높이 44px. Mobile 변경 표 275/448, 키보드 스크롤 가능 |
| 일반 가용성 | 포함/미포함 Fixture 모두 참고 안내 유지. [미포함 결과](evidence/229/availability-not-listed-mobile.jpg)에서도 확인 단계로 진입 가능하며 자동 변경 거절/객실 교체 없음 |
| 취소 전 확인 | [저장 정책](evidence/229/cancel-policy-mobile.jpg)과 [미제공 안내/동의/실제 요청 구분](evidence/229/cancel-acknowledgement-mobile.jpg), [Desktop](evidence/229/cancel-confirm-desktop.jpg) 확인. 동의 전 최종 버튼 disabled, 동의 후 활성화만 확인 |
| CANCELLED | [저장 결과 Desktop](evidence/229/cancelled-result-desktop.jpg)·[Mobile](evidence/229/cancelled-result-mobile.jpg)의 서버 저장 시각/수수료/예상 환불액과 변경/재취소 Action 부재 확인. 실제 취소 Mutation 성공 장면이 아님 |
| 상태 | [Empty](evidence/229/list-empty-mobile.jpg)·[Error](evidence/229/list-error-mobile.jpg), 기존 Timeout 전 Loading status DOM 확인. Mutation 성공/실패 Feedback·잠금은 위 HTTP Mock 자동 테스트로 검증했으며 Browser에서 쓰기를 수행한 것은 아님 |
| 폭 경계 | 확인한 390px·768px·1440px 샘플에서 문서 가로 넘침 0. 320px 상세는 clientWidth 305 / scrollWidth 320으로 기존 #224 D01 재현. 전역 overflow를 숨기지 않았고 #231 후속으로 유지 |

전체 Keyboard/대비/Screen Reader·Zoom·실제 단말/Browser 조합 승인이 아니다. 실제 Backend 연동,
실제 Mutation 지연/Race·세션 Edge Case와 최종 사용자 직접 UI/UX 승인은 f0.6.0에 남긴다.
이번 작업에서 최종 수동 검수 Issue를 새로 생성하거나 자동 완료하지 않았다.
