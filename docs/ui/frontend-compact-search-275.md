# Compact Search Bar와 날짜·인원 레이어 (#275)

2026-11-02(Asia/Tokyo). PR #288이 병합된 `develop`의 `66da717`에서
`feature/#275-compact-search-layers`를 생성했다. #271 명세, #274 공통 프레임,
저장소의 A1/Navy & Ivory·Search·Detail 시안을 확인했다.

## 구현 범위와 상태 소유권

- `CompactSearchBar`: Home·Search·Detail의 도시/날짜 요약/전체 인원 요약/CTA.
  Form을 만들지 않으며 도시명은 기존 exact-city 입력이다. 자동완성은 없다.
- `StayDateFields`/`StayDateCalendar`: 닫힌 날짜 요약과 staged 날짜 편집.
  Desktop 두 달, 좁은 화면 한 달인 native modal Dialog/하단 Sheet다.
  UTC 날짜 helper, 최소 1박, 윤년·연도 경계·키보드 이동을 재사용한다.
  접힌 `날짜 직접 입력`은 native date 입력 대안이다.
- `GuestCountPicker`/`GuestCountField`: Desktop 비모달 Popover, 좁은 화면
  native modal Sheet 안의 전체 인원 Stepper·직접 입력. 성인/아동 분리는 없다.
- `SearchLayer`: Portal, modality, 위치, 닫기, 초점과 스크롤 정리만 담당한다.
  API/Auth/조회 무효화/예약 쓰기 gate를 소유하지 않는다.
- 기존 `SiteHeader`/`RootLayout` 책임과 공유 Token을 유지한다.
  공유 날짜 컴포넌트를 쓰는 예약 변경 화면도 같은 편집기를 사용하되,
  기존 변경·취소 잠금과 고정 인원 계약은 유지한다.

날짜·인원은 **레이어 draft → 명시적 적용 → 현재 폼 조건 → 명시적 조회 → 마지막
제출 조건/결과**로 구분한다. 열기·미리보기·취소·Escape·바깥 닫기는 조회나
예약을 실행하지 않는다. 닫힌 hidden input은 FormData 직렬화 전용이며 required
검증이나 중복 name을 두지 않는다. Portal 안에 중첩 Form도 없다.

Search에서는 적용만으로 URL/결과를 바꾸지 않는다. 검색 제출 때 기존 필터/정렬을
유지하고 page를 초기화하며 Back/Forward는 제출된 URL 조건을 복원한다.
Detail은 실제로 바뀐 조건을 적용할 때 기존 callback으로 가용성/객실 선택/예상
요금을 무효화한다. 늦은 GET 무시, 로그인 후 새 가용성 조회, 예약·변경·취소의
인증/ambiguous-outcome/no-replay 계약을 변경하지 않았다.

인원은 양의 정수 문자열만 적용한다. `0`, 음수, 소수, `2.0`, `1e3`, 범위 초과를
반올림/보정하지 않으며 잘못된 draft는 열린 편집기에 유지한다. 기존
`2147483647` 상한은 API Integer 표현 한계이지 객실 정원 정책이 아니다.
선택 사항인 Home/Search는 명시적으로 빈 인원을 적용할 수 있다.
날짜 체크인 변경은 기존 helper대로 필요한 경우 체크아웃을 다음 날로 보정하고
이를 알린다. 유효하지 않은 체크아웃 직접 입력은 자동 역전하지 않는다.

## 레이어 접근성과 반응형

Modal은 `showModal()`의 실제 top layer/inert 배경을 사용한다. Tab 순환,
Escape/닫기/배경 클릭, trigger 초점 복귀, 이전 overflow 값 복원을 구현했다.
Popover는 `aria-modal`이나 배경 잠금을 사용하지 않고 바깥 클릭/초점 이탈로
닫힌다. 마지막 Tab은 다음 Form CTA로 이동하며 클릭한 바깥 대상의 초점을
빼앗지 않는다. 레이어의 Enter는 입력 중 배경 Form을 제출하지 않는다.

모바일은 safe-area를 고려한 Sheet와 내부 세로 스크롤을 사용한다.
visualViewport 변화에 따라 높이를 제한하고 키보드 공간에 대응한다.
Desktop Popover는 남은 공간에 따라 위/아래로 배치한다.
ResizeObserver/listener는 닫힐 때 정리한다. Popover→Sheet 전환 중 잘못된
인원 draft도 보존하며 두 달→한 달 전환 시 두 번째 달의 초점/roving tab stop도
유지한다. 달력은 44px 날짜 표적을 유지하므로 320px/확대 글자에서는 이름과
키보드 초점을 가진 표 영역만 가로 스크롤한다. 문서 overflow를 숨겨 덮지 않는다.

## 시안 비교와 남은 화면 작업

[캡처 목록·조건](evidence/275/README.md). 원본 Studio는 비교 clip에서 제외했다.
모든 앱 캡처는 실제 React/CSS를 실행한 UI Audit의 fixture GET 결과이며 실제
숙소·가격·Media나 Backend HTTP 통합 증거가 아니다.

| Home 닫힌 검색 Bar | 원본 A1 | 구현 | 확인 |
| --- | --- | --- | --- |
| 1440×900 | 약 89.8px 높이 | 93.75px, x114/y591.06/폭1197 | Hero 안의 4열, 문서 가로 넘침 없음 |
| 390×844 | 약 187.3px 높이 | 190.75px, x22/y474.06/폭331 | 도시/날짜·인원/CTA 3행, 넘침 없음 |

이는 픽셀 일치/사용자 승인이 아니다. 큰 닫힌 native 입력 쌍·Stepper·반복 도움말을
없애고 시안의 정보 밀도로 전환했다. 날짜 Dialog는 실제 740px 폭, 두 달이며
직접 입력 대안·전체 연도 설명·44px 표적 때문에 원본보다 높다(빈 날짜 상태
1440×900에서 785.5px). 인원 Desktop Popover는 원본의 인원 Dialog와 다른,
#275의 제품 요구에 따른 제안이다. 모바일은 둘 다 실제 modal Sheet다.

Search의 제출 조건은 짧은 요약으로, 가격/일정 주의는 펼칠 수 있는 안내로
정리했다. 390px 첫 카드 상단은 약 y911px로, 기존 전체 Form/정렬 구조가
여전히 남아 있다. 상세 필터 Sheet·결과 밀도/사진은 #278/#276의 범위다.
Detail의 공통 Bar는 기존 가용성 영역 안에 있으며 Gallery/예약 Rail 위치를
완성한 것이 아니다(#279). Home 하단의 기존 안내 카드도 #277의 사진 탐색
완성이 아니다. catalog Media 정상/누락/실패 UI 통합은 #276에 남아 있다.

## 검증

- 기존 lifecycle suite를 실제 열기→편집→적용 동작으로 갱신했다. hidden input을
  변경하는 테스트로 우회하지 않는다. 날짜/인원 primitive 및 검색·예약 실패,
  늦은 응답, 로그인 복귀, 변경·취소 상호 잠금 회귀를 유지했다.
- 전체 Frontend: `pnpm test` 77 files / 1,134 tests 성공. `pnpm lint`, `pnpm typecheck`,
  `pnpm format:check`, `pnpm build` 성공. 한 테스트 파일의 format 경고는
  Prettier로 수정하고 전체 format 검사를 다시 통과했다.
- Browser: 1440×900/390×844의 Home/Search/Detail 닫힘·열림 및 full-page,
  날짜 Nov12→14 적용, Space 열기/Enter 증감, 잘못된 인원 적용 차단,
  Escape 초점/스크롤 복귀, Desktop 마지막 Tab의 CTA 이동을 확인했다.
  인원 raw draft 및 두 번째 달 초점의 실제 viewport 전환도 확인했다.
- 320×568와 UI Audit `textScale=200`에서 문서 가로 넘침 없이 Sheet 내부로
  스크롤해 적용/취소에 도달했다. 이는 root font 200% 테스트이며 Browser
  native zoom, 실제 모바일 가상 키보드, 화면낭독기 검증을 대신하지 않는다.
  visualViewport/safe-area 처리는 구현했으나 실제 기기 검증은 남아 있다.
- 확인한 앱 Browser warning/error는 없었다. DOM 테스트의 dialog stub만으로
  native modality를 주장하지 않고 실제 Browser `:modal`도 확인했다.
- Backend/DB/의존성/lockfile/환경변수/실행 설정 변경 없음. 따라서 Backend
  suite는 이번 Frontend-only 작업에서 실행하지 않았다. DB 데이터 쓰기 없음.
- `.github/workflows/frontend-ci.yml`의 install --frozen-lockfile와
  lint/format/typecheck/test/build 흐름을 검토했다. pnpm 11.19.0은 같고
  로컬 Node 24.14.0/CI 24.19.0 차이가 있다. 원격 Actions는 실행하지 않았으므로
  원격 CI 성공으로 보고하지 않는다.

실제 Backend HTTP, 새 Media-present 화면, 사용자 최종 시각 승인과 전체
f0.5.3 통합 완료는 이번 검증에 포함하지 않는다.
