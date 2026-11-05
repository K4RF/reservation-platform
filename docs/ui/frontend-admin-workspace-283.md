# 관리자 작업 공간 재구성 (#283)

검증일: 2026-11-05. #282가 병합된 `develop` (`7d7b3a5`, PR #296)에서 작업했다.
[재구성 명세](prototype-rebuild.md), [승인 디자인](approved-design.md), [#259 이전 관리자 화면](frontend-admin-redesign-259.md),
[#274 프레임](frontend-consumer-frame-274.md), [#276 사진 연결](frontend-media-integration-276.md),
[기존 관리자 업무 통합 검증](../testing/frontend-admin-management-flow.md)과 현재 소스/테스트를 대조했다.
독립 [동작 시안](prototypes/premium-travel/index.html)과 [비교 보드](prototypes/premium-travel/review.html)를 Browser에서 열었다.
관리자 전용 승인 원본은 없다. A1/Navy & Ivory의 브랜드, Search의 비교, Detail의 읽기/선택 분리를 관리자 작업 밀도에 적용했다.
대형 소비자 Hero·Gallery·가상 금액이나 관리자 통계를 복사하지 않았다.

## 화면과 작업 동선

| 영역 | 이전 | #283 |
| --- | --- | --- |
| 작업 메뉴 | 넓은 소개 Header + 메뉴/설명 | 최대 1280px 내 220px 작업 메뉴 + 32px 간격 + 본문. Mobile은 한 줄 메뉴와 짧은 문맥 Breadcrumb |
| 숙소·객실 목록 | 모든 조회 조건이 먼저 노출 | 현재 조건·정렬 요약과 펼치는 검색, 목록 새로 조회/생성/레코드 링크. 응답 대표 사진만 작은 썸네일로 표시 |
| 숙소·객실 레코드 | 읽기·수정·상태·정책·사진이 연속 노출 | 요약이 첫 화면이며 선택한 패널만 표시. 선택한 숙소/객실과 운영 상태를 계속 보여 주고, 부모·하위 객실·가격/재고로 이동 |
| 사진·정책 | 긴 상세 하단에 연속 노출 | 사진 작업과 앨범 조회를 분리하고 삭제 대상이 사진 한 장임을 표시. 예약/취소 정책은 개별 패널에서 작업을 고르고 전체 값 입력. 성공 결과는 폼 위의 직전 응답 |
| 날짜별 가격 | ID 조회·객실 카드·가격·수정 폼 나열 | 이미 선택한 객실의 ID 입력은 펼쳐 사용. 적용 가격을 읽고 편집을 열거나 같은 날짜 재고로 이동 |
| 날짜별 재고 | 표 아래에 선택 날짜 입력 | Desktop은 Calendar와 선택 날짜 편집을 나란히, Mobile은 한 열. 날짜 버튼에서 편집 제목으로, 복귀 버튼으로 해당 날짜에 포커스 |

`AdminPanels`는 패널 선택만 관리한다. 활성 버튼에서 아래 방향키로 패널에 진입할 수 있다.
같은 레코드에서 패널을 바꿔도 입력과 사진 조회 상태를 지우지 않으며, 저장 대기/불명 결과 또는 사진 복구 중에는 다른 레코드 작업으로 전환할 수 없다.
성공/오류 응답 시 기존 Feedback에 포커스를 옮긴다. 별도 모달·Sticky·고정 CTA를 만들지 않아 화면을 덮는 영역이나 닫기/스크롤 잠금은 없다.

## 보존한 계약

- 기존 `ProtectedRoute`, 공용 인증·로그아웃, API·URL 검증과 페이지/세션별 Abort·오래된 응답 무시를 유지했다. 관리자도 사용자 영역에서는 자기 예약만 조회한다.
- 기존 `useAdminMutation`과 Media 게이트를 그대로 사용한다. 같은 대상의 패널 열기/닫기는 쓰기가 아니며 401을 포함한 자동 재실행은 없다. 다른 라우트로 이동하거나 요청을 중단해도 서버 저장이 취소된다는 뜻은 아니다.
- 카탈로그 저장 뒤 실제 새 GET을 사용한다. 정책은 명시적 생성(POST)/수정(PUT)이며 현재 정책 GET·자동 존재 확인·기존 값 프리필이 없다. 응답을 현재 정책으로 표시하지 않는다.
- 가격은 직전 성공 GET의 DEFAULT/DAILY를 따라 생성/수정한다. 재고는 시작·종료일 포함, 미생성과 0/CLOSED 구분, 예약/가용 수량 읽기 전용, INACTIVE 객실 읽기 전용, 모든 쓰기 실패 뒤 fresh Calendar GET + 결과 재확인 + 새 동의를 유지한다.
- 사진은 #276의 소유자 확인·수동 ADMIN GET/ETag·작업 확인·실패 뒤 같은 앨범 새 조회와 재확인을 유지한다. 업로드, alt/출처/사용권, 대표, 정렬, 교체, 명시적 사진 삭제만 지원한다. 숙소/객실/예약 삭제, 전체 예약/사용자 관리, 통계 및 Batch는 추가하지 않았다.

## 검증

[Browser 비교와 재현 조건](evidence/283/README.md). 실제 React/CSS를 1440×900 / 390×844로 렌더링했다.
숙소 상세 제목 상단은 약 420→244px / 629→311px, 요약 문서 높이는 약 4,377→1,139px / 5,817→1,342px였다.
Desktop Calendar 편집은 약 568/378px 두 열, 390px Calendar는 309/576px(보이는 폭/내부 폭)였다.
10자리 수량과 32일 범위를 사용해 키보드 내부 스크롤과 날짜 ↔ 편집 포커스를 확인했다.
320px·글자 200%에서 객실 목록 상태 배지의 넘침을 발견해 작은 화면 목록을 한 열로 바꿨다. 최종 9개 경로의 문서 client/scroll 폭은 305/305px였다.

기존 AdminManagementFlow 및 숙소/객실/정책·가격·재고·Media Suite를 유지하고 새 레코드 동선으로 보완했다.
패널 선택만으로 요청이 나가지 않는지, 초안 보존, 저장 잠금, 재고 행 ↔ 편집 포커스, 정책 저장 결과 포커스와 Audit 쓰기 범위를 검증했다.

Windows Node 24.14.0 / pnpm 11.19.0, `frontend/`에서 `pnpm install --frozen-lockfile`, `pnpm lint`,
`pnpm format:check`, `pnpm typecheck`, `pnpm test`, `pnpm build`, `pnpm exec tsc -p scripts/ui-audit/tsconfig.json`,
`node --check scripts/ui-audit/server.mjs`를 실행했다. 관련 9개 파일/240개, 전체 **80개 파일/1,176개 테스트**가 통과했다.

Browser는 로컬 Fixture로 사진 정상·없음·실패와 정책 POST 성공/불명 오류를 검증했다. 실제 관리자 저장·사진 삭제, 서버 권한·DB·실기기/Native Zoom·Screen Reader는 검증하지 않았다.
Backend, 의존성, 실행 설정, 환경변수, GitHub Actions 변경은 없다. CI와 같은 Frontend 명령을 로컬에서 실행했으며 Ubuntu/Node 24.19.0 원격 CI는 미실행이다.
개발 DB/Volume을 변경하지 않았다. #284 통합 및 f0.6.0 사용자 최종 검수는 별도다.
