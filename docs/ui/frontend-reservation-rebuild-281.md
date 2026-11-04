# 내 예약 제품 화면 재구성 (#281)

작업 시작 2026-11-04 / 최종 검증 2026-11-05.
[이슈 #281](https://github.com/K4RF/reservation-platform/issues/281), 기준 `develop ab93a20`(PR #294 / #280 포함),
브랜치 `feature/#281-reservation-management-rebuild`.
이 문서는 개발자 구현·테스트·격리 Browser 관찰 기록이다. 실제 예약/환불 처리나 사용자 최종 시각 승인이 아니다.

## 기준과 변경 범위

[#271 제품 구성안](prototype-rebuild.md), [승인 기준](approved-design.md),
[원본/보드](prototypes/premium-travel/README.md), [#257 과거 구현](frontend-reservation-redesign-257.md),
[기존 관리 Flow](../testing/frontend-reservation-management-flow.md)를 현재 소스/테스트와 대조했다.
독립 원본과 보드를 Browser에서 열어 Navy/Ivory·사진·서체 언어를 확인했다.
내 예약의 독립 승인 원본은 없으며 원본 Detail을 같은 예약관리 화면의 Pixel Golden으로 취급하지 않는다.
새 f0.5.3(#21)의 #271 구성안 구현이고 f0.6.0 사용자 직접 검수는 별도다.

Backend/API/DTO/Mutation 정책/Route/Auth/의존성/환경변수/Workflow는 변경하지 않았다.
새 상태 필터나 전체 사용자 예약관리, 객실/인원 변경, 취소 견적/결제 기능도 추가하지 않았다.

## 구현

- 목록은 max1120px 사진 여행 카드다. 현재 숙소/객실·상태·일정·박수/총 인원·저장 금액·공개 번호·상세 CTA를 우선한다.
  응답 ID/기술 설명을 주 콘텐츠에서 빼고 기록 기준은 짧게 표시했다. 최신 예약 순/기존 URL Pagination은 유지한다.
- `getReservationCatalog`의 페이지별 Room/Accommodation 중복 제거와 공개 GET을 그대로 사용한다.
  Room의 실제 대표 Media를 우선하고 없을 때만 실제 Accommodation 대표 Media를 쓴다.
  이미지 로드 실패에는 가상 대체 사진을 넣지 않는다. 현재 이름/사진은 역사 Snapshot이 아니라고 표시한다.
  공개 조회 실패가 소유자 기록/저장 금액을 오류나 빈 예약으로 바꾸지 않는다.
- 상세는 본문760 + gap40 + 여행 요약320px이다. 목표의 약720px 본문보다40px 넓게 max1120을 채웠다.
  요약은 Desktop sticky top24/max-height/내부 스크롤이며1024px 이하 또는 높이640px 이하에서는 자연 흐름으로 바뀐다.
  Mobile은 여행 요약→관리 행동→Guest→일별 요금/정책 순서다. 상세 펼침은 이름/키보드 접근 가능한 native details다.
- `ReservationSnapshots`는 활성 준비 화면 하나와 기존 변경/취소 상호 fieldset 잠금을 소유한다.
  관리 행동을 요금/정책 아래에서 본문 첫 위치로 옮겼고, 긴 확인 화면은 넓은 본문에 펼친다.
  #271의 좁은 요약/행동 Rail과 달리 행동은 본문에 두었다. 좁은 Rail 안에 입력/필수 정책을 중첩하지 않기 위한 구성이다.
- 일정은 편집 → 일반 가용성 → 명시적 검토 → 진행/결과다. 검토에서는 편집 폼을 비노출로 전환하되 조회 컨트롤러는 유지한다.
  단순 검토 전환/복귀로 가용성을 다시 읽지 않는다. 날짜 수정으로 돌아가면 참고 가격/동의를 폐기하고 다시 확인한다.
  Room·총 인원·Guest·정책은 고정이며 일반 가용성이 본인 점유를 제외하지 않는 의미와 PATCH의 최종 판단은 유지한다.
- 취소는 열 때 fresh owner GET, 저장 상대 정책/비율, 사전 금액 미제공, 명시적 동의, 한 번의 bodyless PATCH 순서를 보존한다.
  이미 CANCELLED인 응답이면 추가 동의/취소 대신 저장 결과를 보여준다. 브라우저 시간/현재 정책으로 자격·금액을 추정하지 않는다.
- 잠긴 결과에서 닫기/Escape/다른 관리 작업/카탈로그 재조회로 상태를 초기화할 수 없게 했다.
  특히 상세의 기존 카탈로그 재조회 버튼은 관리 잠금을 함께 적용한다. 복구는 각 작업의 명시적 owner GET 경로로 진행한다.
  취소는 모든 실패 후 새 GET/새 확인, 일정 변경은 기존 확정 거절/불명 결과의 다른 분류를 유지한다.
  401 포함 쓰기 자동 replay·다중 클릭·늦은 응답 폐기·세션/소유권 경계는 변경하지 않았다.
- 준비 진입/검토/오류에 Focus를 보내고, 잠기지 않은 Escape/닫기는 트리거로 복귀한다.
  중첩 날짜 Dialog Escape는 해당 레이어에서 처리해 준비 화면까지 닫지 않는다.
  기술 설명은 줄이되 미확정 금액·불명 결과·화면 이탈 후 처리 가능성·결제/환불 미완료 안내는 결정 위치에 남겼다.

## 비교와 Browser 관찰

[전체 증거 목록](evidence/281/README.md)에 Viewport와 full-page를 구분했다.
변경 전 목록 Desktop, 상세 양 폭을 직접 캡처했고, 변경 후 정상/변경 검토/취소 확인/저장 취소 결과/차단 오류를 양 폭에서 캡처했다.
독립 내 예약 시안이 없으므로 비교 대상은 #271 구성안과 변경 전 실제 화면이다. 원본의 가짜 데이터는 제품으로 복사하지 않았다.

| 항목 | 변경 전 → 목표 | 실제 결과 / 남은 차이 |
| --- | --- | --- |
| 목록 | 읽기 기준의 긴 안내+무사진 응답 카드 → 사진 여행 정보 | 실제 대표 Media/짧은 기준/예약 상세 CTA. 상태·기간 필터 UI는 추가하지 않음 |
| 상세 행동 | Desktop 관리 제목 documentY 약1709, 전체2292 → 여행 요약/행동 우선 | Desktop 관리 영역 약306px, 정상 전체1258px. 본문760/요약320/gap40 |
| Mobile | 저장 가격/정책 이후 관리 → 요약·행동 먼저 | 정상 요약 약382px, 관리 영역 시작 약675px, 전체1758px. 긴 필수 취소 정책은 명시적 확인 뒤에만 펼침 |
| 일정 변경 | 편집 폼/조회/확인이 연속 노출 → 단계 구분 | 검토에서 편집 폼 높이0, 기존1/1–1/3 ↔ 변경1/2–1/4와 저장350.25 ↔ 참고246,913.56 비교. Fixture 금액이며 실제 가격 사례 아님 |
| 취소 | 저장 정책/사전 금액 부재/결과의 긴 안내 → 결정 지점에 배치 | 사전 견적 없음·비율·동의·쓰기 후 조회 복구 유지. 실제 PG/환불 완료는 주장하지 않음 |
| Media 없음/404 | 사진 없는 화면만으로 정상 완료 판단 금지 | 목록/상세 양 폭에서 정상·미제공·404 검증. 작은 실패 썸네일 문구의 padding/font도 조정해 잘림을 막음 |

CSS Viewport 1440×900 /390×844, 보조320×568(글자200%, 긴 이름/이메일/큰 금액),390×400.
보통 client 폭1425/375/305px이다. 대부분 저장 JPG는1425×891/375×812/305×541로 IAB export 크기가 CSS Viewport와 다르다.
full-page는 문서 전체 증거이며 같은 위치 Viewport 비교를 대신하지 않는다. 원점 캡처는scrollY0, Focus 캡처는 해당 요소 위치다.

- 1440×900의 긴 취소 화면에서scrollY944일 때 요약 top24/bottom733, Focus 행동 y678–722, 가로 초과0.
  Sticky가 본문을 덮지 않으며 요약 자체가 길면 제한 높이 안에서 스크롤한다.
- 390×844 차단 오류에서 오류 y358–486, 가로 초과0. 실패 후 Escape에도 확인이 남고 변경/닫기 행동이 비활성인 것을 확인했다.
- 320px/글자200%에서 처음 상태 배지가16px 넘치는 것을 확인하고, 아주 좁은 폭은 썸네일+정보를 한 열로 재배치했다.
  수정 후 문서 가로 초과0, 준비 제목 Focus y409–505. 가격 표만 이름 있는 내부 스크롤을 유지한다.
- 390×400에서 다음 조회 행동 Focus y178–222, 가로 초과0/요약 static. 고정 하단 Mutation CTA를 새로 만들지 않았다.
  이는 전역 fixed/sticky 제거가 아니라 Desktop 요약과 좁은 입력/확인 화면의 재배치다.
- Media 실패 후 날짜/동의/저장 금액 유지, 준비 Escape Focus 복귀, 비공개 상태/세션 교체는 기존 Suite와 추가 테스트로 확인했다.

한계: 실제 Zoom/OS 확대/실기기 가상 키보드·노치 safe-area/스크린리더 전체 탐색은 미검증이다.
root 글자200%와 짧은 Viewport가 이들 실기기 검증을 대체하지 않는다. 200%+320px에서는 한 열/긴 줄바꿈이 의도되며 시각 최종 승인이 아니다.

## 검증

기존 `ReservationManagementFlow` 및 세부 Suite를 확장했다. 테스트 삭제/disable/새 전체 Lifecycle Suite 복제는 없다.

| 검증 | 결과 |
| --- | --- |
| 관련10 files | 174 tests 통과 |
| 전체 `pnpm test` | 80 files /1,174 tests 통과 |
| `pnpm install --frozen-lockfile` | Already up to date, 의존성/Lockfile 변경 없음 |
| `pnpm lint`, `pnpm format:check`, `pnpm typecheck`, `pnpm build` | 통과 |
| Audit `tsc -p scripts/ui-audit/tsconfig.json`, `node --check scripts/ui-audit/server.mjs` | 통과 |

새 검증: 실제 Room Media 우선/Accommodation fallback·페이지 중복 제거, Media 실패 뒤 변경 날짜/동의 보존,
활성 준비 화면 하나/중첩 Escape/트리거 복귀, pending/실패 취소에서 카탈로그 재조회와 Escape로 잠금 우회 금지.
기존 단일 PATCH/bodyless 취소/401 비자동 replay/소유권/USER·ADMIN 본인 경계/새 GET 복구/
잘못된 응답·legacy/null·시간/금액 정확성/History·세션/늦은 응답 검증도 유지했다.

초기 검증에서 새 UI 문구/접힌 표에 대한 기존 선택자와 없는 spacing Token을 조정했다.
추가 테스트 Mock의 RequestInit 타입도 보완했다. 실패를 숨기거나 동작 검증을 삭제하지 않았다.

로컬 Node24.14.0 /pnpm11.19.0. Frontend CI는 Node24.19.0 /pnpm11.19.0에서 같은
install/lint/format/typecheck/test/build를 실행한다. 새 서비스/env/dependency/workflow가 필요하지 않다.
push/PR/원격 CI는 이번 요청에 포함되지 않아 실행하지 않았다. Backend 변경이 없어 Backend test/build도 실행하지 않았다.

## 검증 경계와 후속

- Browser는 [격리 Audit](../../frontend/scripts/ui-audit/README.md)의 실제 AppRoutes/Component/CSS + 합성 인증/GET Fixture다.
  사진은 [AI 콘셉트](prototypes/premium-travel/ASSETS.md)이며 실제 시설 근거가 아니다. 실제 DB/storage에 업로드하지 않았다.
- 이 작업에서 Audit 쓰기 허용을 추가하지 않았다. Browser 취소 실패는 기본405 AUDIT_READ_ONLY 차단이다.
  실제 서버/네트워크 실패가 아니며 실제 취소도 아니다. 저장 취소 결과는 별도cancelled GET Fixture다.
  성공·불명 PATCH/소유권·재고·Commit의 전체 연결은 HTTP Mock Suite 증거와 실제 Backend 검증을 구분한다.
- 실제 Backend/인증/Redis/DB Commit/Media 저장 연동과 사용자 최종 UX 승인은 #284/f0.6.0에 남긴다.
  개발 DB/Volume/실계정·실제 예약은 변경하지 않았다.
- 상태/기간 필터 UI, 서버 멱등성·다중 탭 쓰기 방지, 취소 전 금액 견적, 결제 취소/실제 환불 완료는 이번 범위 밖이다.
