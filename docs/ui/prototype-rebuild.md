# 승인 시안 기반 제품 화면 재구성 명세 (#271)

작성·실측: 2026-10-29. 기준 소스: develop `2ca1821`(PR #270 병합).
[이슈 #271](https://github.com/K4RF/reservation-platform/issues/271)의 **문서 명세**다.
이번 변경은 화면/API/데이터 구현이나 사용자 시각 승인 완료를 의미하지 않는다.

## 1. 현재 작업 기준과 증거

2026-10-29 사용자 피드백은 “예시 페이지처럼, 기존 베타 내용에 스타일만 덮지 않기”다.
기존 DOM·도움말·배치를 고정하지 말고 **정보 구조·밀도·상호작용을 재구성**한다.
보존 대상은 도메인/상태/요청 계약이다. #253–#260의 의도적 차이는 새 목표의 자동 승인 예외가 아니다.

| 구분 | 상태 / 적용 방법 |
| --- | --- |
| [승인 기준](approved-design.md), [동작 시안](prototypes/premium-travel/index.html), [비교 보드](prototypes/premium-travel/review.html) | Home A1 + Navy & Ivory, Search/Detail의 역할과 사진 중심 구성을 참조한다. A2/다른 배색은 보관안 |
| 원본 [Home 1440](prototypes/premium-travel/screenshots/a1-1440.png) / [390](prototypes/premium-travel/screenshots/a1-390.png) | 2026-10-22 독립 시안 캡처. 실제 제품/매물 증거가 아님 |
| 원본 [Search 1440](prototypes/premium-travel/screenshots/search-1440.png) / [390](prototypes/premium-travel/screenshots/search-390.png) | 사진 카드·검색 요약·필터 진입의 참조. 가짜 가격/리뷰/상태 시연 UI는 제외 |
| 원본 [Detail 1440](prototypes/premium-travel/screenshots/detail-1440.png) / [390](prototypes/premium-travel/screenshots/detail-390.png) | 비대칭 Gallery·객실·예약 Rail·고정 CTA의 참조 |
| [#260 개발자 검증](frontend-visual-regression-260.md), [당시 캡처](evidence/260/) | **2026-10-28 과거 Viewport 증거**. Home/Search/Detail의 각 1440/390을 대조했다. Search는 스크롤된 카드 위치이며 전체 페이지/첫 결과 위치 측정 자료가 아님 |
| 현재 소스 `2ca1821` | 위 캡처와 별도로 HomePage, RootLayout, AccommodationSearchForm, AccommodationDetailPage, RoomAvailabilitySection/RoomListSection 및 index.css·Response 타입을 확인 |
| 아래 Booking/내 예약/Auth/Admin 구성안 | 전용 승인 원본이 없는 **새 제품 화면 제안/후속 구현 목표**. 기존 원본의 직접 승인 화면이라고 보고하지 않음 |

### 버전·승인 구분

- f0.5.2 **Milestone #19**: #251 토큰, #252–#260 구현/회귀 기록. 사용자 최종 시각 승인이 아니다.
  그 단계가 과거에 사용했던 이름도 f0.5.3이었다. 역사 문서의 이름은 일괄 치환하지 않는다.
- **새 f0.5.3 Milestone #21**: #271 명세 → #274–#284 실제 제품 화면 재구성/검증.
- v0.4.1 **Milestone #20**: 실제 Media 선행 #272/#273. Room Metadata/정책 GET의 모든 확장을 이 두 이슈가 제공한다고 가정하지 않는다.
- f0.6.0 **Milestone #17**: 실제 전체 연동 및 사용자 직접 최종 검수. 자동 승인/종료하거나 임의로 REVIEW 이슈를 만들지 않는다.

작업 순서: 해당 Issue → 이 명세 → 승인 기준/원본 Browser → 선행 Issue 결과와 현재 소스/테스트.
선행 완료 여부는 작업 시 다시 확인한다. 이 문서는 후속 이슈 완료 증거가 아니다.

## 2. 원본 실측 — 화면 재구성의 출발점

[style.css](prototypes/premium-travel/style.css) 및 Browser의 `getBoundingClientRect()` /
`getComputedStyle()`로 측정했다. 단위는 CSS px, 소수는 반올림했다.
1440×1000 / 390×844 Viewport에서 세로 스크롤바를 제외한 client 폭은 약 1425 / 375였다.
OS 서체/스크롤바 차이를 포함한 절대 Pixel Golden이나 모든 수치의 사용자 승인이 아니다.
비율·구조를 우선하고 실제 구현의 차이는 같은 조건으로 설명한다.

앱 원점은 `#page`의 상단이다. 원본 Studio 도구바 약 **53.8 / 71.5px를 Y에서 제외**했다.
아래 원본 Y에는 앱 내부 `.demo-note`(Search/Detail **43 / 53.8px**)와
Search `.state-demo`(**25.8px + 주변 간격**)가 남아 있다. 둘 다 **제품에서는 제거**한다.
따라서 원본 결과 Y를 그대로 제품 목표로 복사하거나 도구바를 두 번 빼지 않는다.

### Home A1

| 요소 / 원본 selector | 1440 | 390 |
| --- | --- | --- |
| Header `.mast` | absolute overlay, H94, 좌우 5.5%(약78) | overlay, H72, 좌우22, 한 줄 핵심 Nav |
| Hero `.hero` | H740, padding 150px 8% 180px | H720, padding 125px 24px 250px |
| 제목 `.hero h1` | 5.3vw=76.3, clamp 48–80, line-height 1.08, 약2줄; x114/y253 | 49, line-height 1.06, 약3줄; x24/y160 |
| Hero 이미지 | cover, object-position 62% 50% | cover, 63% 50% |
| 닫힌 `.searchbar` | x114/y598, W1197(84%), H89.8, bottom52, padding13 | x20/y481, W335, H187.3, bottom52, padding8 |
| 검색 구조 | 여행지 / 날짜 / 인원 / CTA, 1.1fr 1.4fr .85fr auto | 여행지 전체 행 → 날짜/인원 → CTA 전체 행, 최소44px |
| 사진 탐색 `.section` | y740, padding80px 8%; 제목40/1.15 | y720, padding45px 22px; 제목31/1.15 |
| `.explore-grid` | y982, W1197, 1.4:1 열(682/487), gap28; 사진 H360 | y941, W331, 1열, gap15; 사진 H290 |
| Footer | padding28px 8%, 작은 보조 정보 | padding24px 22px, 세로 배치 |

Hero 내 검색이 닫힌 기본 상태에서 첫 화면에 보인다. 큰 폼을 Hero 아래에 겹쳐 놓는 구성과 다르다.
두 탐색 사진은 서로 다른 역할/내용을 갖되, 실제 제품 링크는 실제 카탈로그 읽기 결과에만 연결한다.

### Search

| 요소 / 원본 selector | 1440 | 390 |
| --- | --- | --- |
| Header | normal flow H94 | H72 |
| `.page-heading` | y137, padding48px 6% 32px, H214; h1 46 | y126, padding32px 22px 24px, H174; h1 35 |
| `.compact-search` | x85.5/y351, W1254(88%), H89.8 | x20/y299, W335, H187.3 |
| `.search-layout` | y472, padding0 6% 70px; sidebar225 + gap46 + result983 | y512, padding0 20px 40px; sidebar 비노출, 필터 Trigger |
| Result tools | H21.5, 아래20px | H68.5(줄바꿈), 필터/정렬 진입 우선 |
| `#results` 첫 카드 | y560 **시연 행 포함**, 2열 W478, gap26/32 | y646 **시연 행 포함**, 1열 W335, gap24 |
| `.stay-photo` / 카드 본문 | 사진 H240(약2:1), cover center; padding24; 제목23, 설명13, 위치11 | 사진 H250(약4:3), padding22 |

**제품 목표 제안**: 시연 안내/상태 버튼 제거 후 같은 짧은 제목·닫힌 검색 조건에서 첫 카드 시작을
대략 Desktop Y470–500 / Mobile Y520–560에 둔다. 이는 원본의 직접 실측값이 아니라
제거할 행을 반영한 배치 목표다. 실제 데이터/서체로 재측정하고 이유 없이 긴 폼으로 밀리지 않는지 비교한다.
데이터 오류/긴 제목/확대 상태에 이 높이를 강제해 잘라내지 않는다.

### Detail

| 요소 / 원본 selector | 1440 | 390 |
| --- | --- | --- |
| Header / breadcrumb | H94 / padding26px 6% 0, 글자12 | H72 / padding20px 22px 0, 글자10 |
| `.detail-title` | padding24px 6% 32px, h1 38/1.25 | padding22px, h1 30/1.25 |
| `.gallery` | x57/y359, W1311(92%), H455, 1.8:1 열(836/465), gap10 | x14/y313, W347, H350, 대표 1열 + 사진 더보기 |
| Gallery crop | cover center | cover 63% 50% |
| `.detail-body` | y814, padding52px 6% 70px, 본문839 + gap70 + Rail345 | y663, padding30px 22px 100px, 1열 |
| 본문 Nav | 글자13, gap30, padding-bottom20, margin-bottom35 | 글자12, gap26, 가로 접근 가능 |
| `.room-card` | 사진230×260 이상 + 본문, 본문 padding25 | 사진 H250 + 본문 padding22, 1열 |
| `.book-panel` | W345, padding28, **sticky top24** | 본문 확인 패널, padding24, 위 margin32 |
| `.mobile-book` | 비노출 | **fixed bottom0**, H약72, padding12px 18px, CTA 최소44px |

시연 안내만 제거한 Gallery 시작 참고값은 약 **Y316 / Y260**이다(원본 Y에서 해당 안내 높이 제외).
Mobile fixed CTA의 Y는 Viewport 좌표이며 문서 스크롤 Y와 혼합하지 않는다.
원본은 safe-area/키보드 모든 경우의 검증 증거가 아니다. 실제 구현에서 별도로 해결한다.

### 공통 레이어·시각 언어

- Navy/Ivory semantic Token은 [#251](frontend-navy-ivory-tokens-251.md)을 재사용한다.
  Display Serif/한글 UI Sans, 큰 제목→짧은 소개→내용/CTA 계층. 작은 원본 글자를 그대로 줄여 접근성을 희생하지 않는다.
  Coral은 절제된 장식이며 성공/오류/취소 의미 색과 구분한다.
- 원본 날짜 Dialog는 W740/max(100vw−32), padding32, max-height90dvh, 2개월/gap28.
  Mobile≤700은 padding22/max(100vw−24)/91dvh, 1개월, 날짜 버튼 H44.
  제품은 직접 날짜 입력 대안과 최소1박·적용/취소를 함께 제공한다.
- 원본 인원 선택은 Dialog이며 −/+ 버튼44px이다. #275의 Desktop Popover / Mobile Sheet는
  **제품 상호작용 제안**이다. 원본에 이미 동일 Popover가 있다고 주장하지 않는다.
- 원본 객실 Dialog W880, 사진 H350; Mobile 사진 H230. 제품의 기존 native Modal/Sheet 수명주기를 유지한다.
- 메뉴/달력/필터/Gallery의 접근성 대안은 같은 정보·조작·Focus 복귀를 제공해야 한다.
  “안전해서 static”만으로 sticky Rail/고정 CTA/Sheet를 생략하지 않는다.

## 3. 현재 표현 → 교체 목표

아래 현재 상태는 `2ca1821` 소스와 #260 당시 증거를 대조한 것이다. 새 구현 완료 목록이 아니다.

| 영역 | 현재 확인 | 유지 / 교체 / 제거 |
| --- | --- | --- |
| RootLayout Header | 공통 Ivory, Mobile 브랜드/전체 Nav 여러 행 | 역할/실제 경로/Logout gate 유지. Home overlay + 타 화면 Ivory, Mobile 한 줄 브랜드/핵심 메뉴로 **교체** (#274) |
| HomePage/index.css | Header 아래 별도 Hero(40rem/모바일36rem), 검색 패널 음수 margin, 긴 입력/설명, 탐색 안내 카드 | 상태/검색 URL 유지. 건축·따뜻한 빛·바다의 브랜드 Hero와 내부 compact 검색, 실제 사진 탐색으로 **교체** (#277) |
| AccommodationSearchForm/StayDateFields/GuestCountField | 날짜 직접 입력+달력 열기, Stepper/설명이 기본 폼에 함께 노출 | 검증·직접 입력·draft/apply 계약 유지. 닫힌 요약+Dialog/Popover로 **교체** (#275). 중복 안내/상시 큰 폼 **제거** |
| Search/AccommodationList | 2열/1열이나 큰 미제공 슬롯, 긴 필터와 기술 제약 설명; Mobile native details | 실제 필터/정렬/URL 유지. 사진 카드+필터 Sheet로 **교체** (#278). 페이지 크기/내부 enum을 주요 소비자 UI에서 **제거**, 기존 URL 호환은 유지 |
| AccommodationInfo/Detail | 큰 단일 빈 사진 영역, 소개/이용 안내/선택 이동 | 실제 소개/운영 시간/ZoneId 유지. 비대칭 실제 Gallery+짧은 Nav+본문/Rail로 **교체** (#279) |
| RoomAvailabilitySection + RoomListSection | 같은 Detail에 가용 객실과 별도 기본 객실 목록, 선택 패널 안 BookingFlow | 상세 fresh GET/ID/선택 무효화 유지. 하나의 주 객실 비교/선택 표현으로 통합, **중복 목록 제거**. 날짜 없는 탐색은 읽기 전용, 날짜 적용 시 가용 결과로 전환 (#279/#280) |
| 사진 미제공 | Search/Detail/Room에 슬롯이 있지만 Media Response 계약 없음 | 없음/실패 상태 자체는 유지. 정상 완료 화면을 큰 빈 슬롯으로 대체하는 것은 **불가**. Media 선행 후 실제 사진, 없음은 작은 대체 표현 (#272–#276) |
| 도움말/경고 | API/Backend/DTO 제약 설명, 동일 의미 안내 반복 | 구현 설명은 문서/관련 도움말로 **이동**. 가격 기준·총 인원·수수료·불명 결과 잠금·복구 행동은 해당 결정 지점에 간결히 **유지** |

원본 Studio/Palette 스위치/상태 시연 버튼/가짜 숙소·금액·리뷰는 제품에서 **제거**한다.
검색 카드 최저가/총액이 없으면 가격을 만들어 넣지 않고 실제 숙소 상세/객실 탐색 CTA로 균형을 맞춘다.
홈 브랜드 이미지 출처 표기는 간결히 남기되 실제 숙소 사진이라고 표현하지 않는다.

## 4. 원본 대응 화면의 실행 명세

| 화면 / 담당 | 정상 1440 → 390 | 오류·빈 상태·확인 | 완료 수용 기준 |
| --- | --- | --- | --- |
| Home #277 | overlay Header → 넓은 Hero/두 줄 Display/내부 compact 검색 → 사진 탐색 비대칭2열. Mobile 한 줄 Header/3줄 제목/187px 수준 닫힌 검색/1열 사진 | 이미지 실패해도 검색 입력 보존; 탐색 GET 오류/빈 결과는 해당 섹션에만 재조회/전체 숙소 링크 | Hero 내부 검색·사진 탐색 모두 존재. 기존 01/02/03 안내 카드나 외부 긴 폼으로 대체하지 않음. 양 폭의 전체/첫 Viewport 비교 |
| Search #278 | 짧은 Editorial 제목 → compact 검색 → 결과 수/정렬 → sidebar+2열 사진 카드. Mobile 1열+필터 Sheet | 최초 Loading/오류/Empty와 마지막 제출 조건 구분. Sheet draft는 적용 전 결과/URL을 바꾸지 않으며 취소는 폐기 | 사진 있는 정상 카드/없는 카드/실패 모두 확인. 상세 복귀 후 새 GET/위치·Focus 복원, AND 편의시설·정확 city/region·기존 정렬 의미 유지 |
| Detail #279 | 검색 복귀/제목·위치 → 비대칭 Gallery → 소개/객실/이용 안내 + sticky Rail. Mobile Gallery→객실/선택 + fixed CTA | Gallery 오류는 조회/선택을 초기화하지 않음. 가용성 Loading/Empty/Error는 선택 gate와 연결. 객실 선택 전에는 객실 탐색, 유효 선택 뒤에만 계속 | Gallery 클릭이 선택/쓰기가 아님. 주 객실 목록은 하나, 읽기 전용 탐색과 가용 선택 구분. 조건 변경/INACTIVE/정원/ID 불일치 시 기존 선택/예상 금액 무효화 |

Rail/CTA는 조건 요약·선택 객실·유효한 예상 요금·다음 행동을 보여준다. 로그인 전 계속은 Login으로,
로그인 복귀 후에는 fresh Availability로만 선택을 복구한다. 가용성 성공이 예약 확정은 아니다.
사진/소개/편의시설은 실제 공개 DTO 필드만 쓴다. Room Description/Bed/Size/View는 별도 계약 없이는 표시하지 않는다.
날짜 없는 카탈로그 탐색도 보존하되 두 개의 같은 객실 목록을 동시에 쌓지 않는다.

## 5. 전용 승인 원본이 없는 제품 화면 구성안

이 절의 폭·배치는 **새 설계 제안/구현 목표**다. 원본 실측이나 사용자 직접 승인이 아니다.
공통 Ivory 바탕·Surface·Navy CTA·짧은 제목·사진/내용 여백 언어를 잇되, 기존 긴 폼을 감싸는 작업으로 끝내지 않는다.
추가 Route/API/인증 구조를 임의로 만들지 않는다. 같은 Route에서도 단계별 표현/컴포넌트 분리는 가능하다.

### Booking (#280)

| 상태 | 1440 구성안 | 390 구성안 / 안전 경계 |
| --- | --- | --- |
| 정상 입력 | max1120 안 투숙객 입력 약640 + gap48 + 여행 요약 약360. 상단은 선택 숙소/객실·일정·총 인원, 본문은 대표 투숙객 입력 | 좌우20, 짧은 여행 요약→입력→검토 CTA. 전체 Detail/객실 목록 밑에 또 긴 Booking 폼을 붙이지 않음 |
| 최종 확인 | 입력과 구분된 요약/가격 근거·투숙객 검토, 명시적 최종 예약 버튼 | 검토 제목/오류로 Focus 이동, 편집 복귀 가능. 추정 합계와 확정 전 상태를 한 번 명확히 안내 |
| 오류/불명 결과 | 필드 오류는 입력 옆, 조회 오류는 요약 영역. 쓰기 결과 불명은 제출 영역 잠금/확인 행동 | 입력/가격 상태를 사진 오류로 지우지 않음. 401 포함 POST 자동 재실행 금지, 기존 submit gate·복구 규칙 유지 |
| 완료 | 서버 예약 ID로 owner GET 후 예약번호/저장 일정·금액/투숙객/내 예약 CTA. 단순 응답 카드를 되풀이하지 않음 | 같은 우선순위의 1열. GET 실패는 완료 사실을 추측하지 않고 다시 조회 안내. 결제/환불 완료라고 쓰지 않음 |

현재 카탈로그 이름/사진은 저장 예약 Snapshot이 아님을 구분한다. 사진은 #276 실제 계약에 의존한다.
예상 요금은 기존 날짜별 공개 가격 GET, 최종 금액은 예약 Response/owner GET만 근거로 한다.
통화·세금·수수료·PG 절차를 새로 만들지 않는다.

### 내 예약 목록·상세·변경·취소 (#281)

| 상태 | 1440 구성안 | 390 구성안 / 안전 경계 |
| --- | --- | --- |
| 목록 정상 | max1120 여행 카드: 사진/장소·객실, 기간·상태, 총 인원·저장 금액·예약번호, 상세 CTA 순. 설명/표가 목록 첫 화면을 지배하지 않음 | 좌우20, 작은 썸네일+주요 여행 정보→금액/CTA. 긴 번호/이름 줄바꿈. 실제 지원 Pagination 유지 |
| 상세 정상 | 약720 본문 + gap40 + 약320 요약/행동. 저장 정보와 현재 카탈로그 구분, 박별 요금/정책은 이름 있는 상세 펼침 | 1열 여행 요약→행동→저장 투숙객→박별/정책. 읽기 결과를 사진/이름 GET 실패로 숨기지 않음 |
| 변경 준비/확인 | 현재 일정 ↔ 요청 일정/참고 금액 비교, 고정 객실·인원, 변경 확인. 기존 예약까지 새 요청 결과로 덮지 않음 | 현재→요청 순, 오류는 수정 지점에. 일반 가용성은 본인 점유를 제외하지 않으므로 목록 유무로 변경 가능/불가 단정 금지 |
| 취소 확인/결과 | 열 때 fresh owner GET → 저장 정책의 상대 경계/비율 → 명시적 동의/취소. 이미 CANCELLED이면 저장 결과로 전환 | 사전 수수료/환불액 미제공을 CTA 옆에 짧게 표시. 브라우저 시각으로 취소 가능/요금 견적 계산 금지, preview 목적 PATCH 금지 |
| 오류/불명 결과 | owner 403/404, 목록 오류/빈 결과, 변경·취소 실패를 각각 표현 | 변경/취소 pending 상호 차단. 자동 replay 금지, 불명 결과 잠금/상세 GET/새 확인 절차 유지. 취소 실패 시 새 GET/확인 전 닫기·재제출 gate도 유지 |

ADMIN도 사용자 영역에서는 본인 예약만 다룬다. 저장 nightly/total/policy/cancel 결과와 현재 catalog 이름/사진을 혼동하지 않는다.
실제 결제 취소/환불 완료나 새 상태 필터 UI를 계약 확인 없이 추가하지 않는다.

### Auth·접근 안내 (#282)

| 상태 | 1440 구성안 | 390 구성안 / 안전 경계 |
| --- | --- | --- |
| Login/Signup 정상 | max960 짧은 목적 안내 + max420 입력 영역. 이메일/Google와 실제 다음 행동을 우선, 거대한 장식 패널 대신 여백/서체로 브랜드 표현 | Header 뒤 제목→입력/Google→다음 행동. 입력·오류를 큰 사진/브랜드 패널이나 여러 행 Nav 아래로 밀지 않음 |
| 확인/대기 | Signup 성공의 실제 다음 행동, Callback 처리 대기, 유효한 로그인 복귀 목적을 분리 | 중복 제출 차단, 상태 안내가 Focus/읽기 순서를 가리지 않음. 성공/대기에서 자동 쓰기 재실행 없음 |
| 오류/403/404 | 필드/로그인/Callback 실패는 원인 범위와 가능한 재시도·이동만, 접근 거절/없는 경로는 별도 짧은 안내 | 민감한 토큰·투숙객 정보를 URL/오류 문구로 노출하지 않음. 실제로 없는 비밀번호 찾기/Provider/약관 동의 링크를 발명하지 않음 |

AuthProvider/메모리 Token Pair/single-flight 재발급/Logout/ProtectedRoute/검증된 Return URL은 그대로다.
탐색 복귀의 날짜·인원·IDs·원본 검색 Query만 유지하고 투숙객·가격 Snapshot은 이관하지 않는다.

### ADMIN (#283)

| 상태 | 1440 구성안 | 390 구성안 / 안전 경계 |
| --- | --- | --- |
| 탐색/조회 | max1280 내 작업 Nav 약220 + gap32 + workspace. 상위 숙소/객실 문맥 고정, 목록→상세 읽기→명시적 편집→결과를 구분 | 한 줄 작업 전환/문맥 Breadcrumb→목록·선택 항목→편집. 모든 GET/POST/PUT 폼을 처음부터 연속 노출하지 않음 |
| 편집/확인 | 선택 문맥의 입력만 열고 읽기 값과 수정 값 구분. 사진 관리는 #276 실제 upload/alt/출처/대표/순서/삭제만 연결 | 직접 ID 진입/검증은 유지하되 반복 입력 감소. 명시적 확인 후 한 번 제출. 작업 전환으로 pending/불명 결과 잠금이 우회되지 않도록 상태 소유자 유지 |
| 성공/마지막 결과 | catalog 성공 후 GET, 정책은 마지막 쓰기 결과, price는 성공 GET의 DEFAULT/DAILY에 따른 POST/PUT, inventory는 fresh Calendar | 정책 GET이 없으므로 자동 존재 감지/프리필 금지. 수량/상태만 수정, reserved/available/version은 읽기 전용, 미생성 날짜를 0/CLOSED로 표시하지 않음 |
| 오류/불명 결과 | 페이지 submit gate와 영역별 실패/명시적 결과 검토, stale scope 응답 무시 | 쓰기 401 replay 금지. 정책/가격/재고의 서로 다른 복구 절차 유지. Inventory 실패는 fresh GET+결과 검토+새 동의. INACTIVE Room 재고 쓰기 금지 |

관리가 아닌 통계 Dashboard/전체 사용자 예약/일괄 작업/카탈로그 삭제는 만들지 않는다.
Media 삭제는 #273/#276 계약 범위이지 숙소·객실 삭제 기능이 아니다.

## 6. 데이터·Media 선행과 자산 정책

현재 AccommodationResponse/RoomResponse에는 이미지 URL/Gallery 계약이 없다.
따라서 이번 명세가 실제 사진 연결 가능 또는 DTO 확장 완료를 뜻하지 않는다.

| 화면 | 필요한 실제 데이터·자산 | 선행 / 미제공 처리 |
| --- | --- | --- |
| Home | 별도 사용권 있는 브랜드 Hero, 실제 ACTIVE 숙소의 대표 Media·이름/위치 | #272→#273→#276, #277에서 유한한 조회·정렬 기준 명시. 가짜 인기순/추천 점수 금지 |
| Search | 검색 Response의 대표 Media·기존 설명/편의시설/위치 | #272/#276. 카드마다 무제한 Room/Media GET으로 가격·사진 집계 금지. #278에서 짧은 없음/실패 표현 |
| Detail/Room | 숙소 Gallery·Room Media, 현재 소개/운영 시간/정원/기본 가격/가용성 | #272/#276, #279. Metadata/정책 GET 부재는 새 계약 전 그대로 유지 |
| Booking/내 예약 | 현재 카탈로그 Media/이름 + 기존 예약/가격/정책 Snapshot | #276; 사진/이름 실패는 저장 정보/입력/쓰기 gate와 독립 |
| Auth/접근 | 브랜드/타이포그래피만으로 구성 가능 | 실매물 사진 필요 없음. 가짜 서비스 기능/약관/외부 서체 계약 생성 금지 |
| ADMIN | 기존 catalog/가격/재고/정책 write + 검증된 Media read/write | #273/#276. 업로드 부분 실패/DB·파일 수명주기/삭제 후 읽기 계약까지 확인 |

#272는 소유/대표/정렬/alt/크기/출처·권리, 공개 Response/OpenAPI, 유한 조회와 캐시 호환을 확정한다.
#273은 ADMIN 권한·실제 디코딩/크기 제한·안전 경로·파일/DB 실패·고아 파일/삭제 복구·캐시 무효화를 구현한다.
#276은 그 확정된 계약을 연결하며 임의 endpoint/필드명/Storage 업체를 선점하지 않는다.
유료 서비스 가입/배포/비밀값 추가는 이번 범위가 아니다.

[Prototype ASSETS](prototypes/premium-travel/ASSETS.md)는 **참조 전용 가상 사진**이다.
실매물에 붙이지 않는다. Home 브랜드 자산은 [현재 출처 기록](../../frontend/src/assets/brand/README.md)과
별도로 #277에서 적합성/사용권을 검토하고 변경 시 출처·Prompt·용도를 기록한다.
생성 사진이 실제 시설을 보여준다고 주장하지 않는다. 합성 매물은 격리된 Demo/테스트에서만 표시한다.
alt/크롭·width/height 또는 aspect-ratio·후보 크기·첫 사진 eager/하단 lazy·레이아웃 이동·부분 실패는 #276에서 검증한다.

## 7. 후속 이슈 지도·보존할 회귀 Suite

이슈 링크는 모두 `https://github.com/K4RF/reservation-platform/issues/{번호}`다.
아래 선행은 현재 각 이슈 본문을 확인한 순서이며 완료 상태는 작업 시 다시 확인한다.

| 이슈 | 선행 | 구현 / 수용 확인 | 기존 Suite (`frontend/src/` 기준) |
| --- | --- | --- | --- |
| [#272](https://github.com/K4RF/reservation-platform/issues/272) | #271 | Media 모델/공개 read·제약·캐시·기존 행 호환, 실제 Backend 테스트 | Backend 기존 catalog/constraint/cache Suite를 확장; 파일명은 구현 시 탐색 |
| [#273](https://github.com/K4RF/reservation-platform/issues/273) | #272 | ADMIN Media·파일 수명주기·부분 실패/격리 HTTP | Backend 권한/검증/캐시/트랜잭션 회귀 및 Media 신규 동작 테스트 |
| [#274](https://github.com/K4RF/reservation-platform/issues/274) | #271 | Header/Footer/frame, Mobile 메뉴 Focus/닫기/role별 경로 | `app/routes.test.tsx`, `app/protectedRoutes.test.tsx`, `app/adminRoutes.test.tsx` |
| [#275](https://github.com/K4RF/reservation-platform/issues/275) | #271/#274 | compact bar/날짜 Dialog/인원 Popover, draft/apply/입력 대안 | `components/room/StayDateFields.test.tsx`, `GuestCountField.test.tsx`, `pages/AccommodationSearchNavigation.test.tsx` |
| [#276](https://github.com/K4RF/reservation-platform/issues/276) | #271/#272/#273 | 실제 Media API/이미지/Gallery/Admin UI, 격리 HTTP upload→public read→교체/삭제 | `pages/AccommodationDetailPage.test.tsx`, `components/room/RoomDetailTrigger.test.tsx`, `test/AdminManagementFlow.integration.test.tsx` + 실제 신규 Media 동작 |
| [#277](https://github.com/K4RF/reservation-platform/issues/277) | #274/#275/#276 | Home overlay/Hero/내부 검색/사진 탐색 | `app/routes.test.tsx`, `test/BookingCreationFlow.integration.test.tsx` |
| [#278](https://github.com/K4RF/reservation-platform/issues/278) | #274/#275/#276 | Search 사진 카드/필터 Sheet/URL 복귀 | `pages/AccommodationSearchPage.test.tsx`, `AccommodationSearchNavigation.test.tsx`, `components/accommodation/AccommodationList.test.tsx` |
| [#279](https://github.com/K4RF/reservation-platform/issues/279) | #274/#275/#276 | Detail Gallery/단일 비교/Rail/Mobile CTA | `pages/AccommodationDetailPage.test.tsx`, `components/room/RoomAvailabilitySection.test.tsx`, `RoomDetailTrigger.test.tsx` |
| [#280](https://github.com/K4RF/reservation-platform/issues/280) | #271/#279 | Booking 입력/검토/서버 완료 분리 | `components/booking/BookingFlow.test.tsx`, `BookingSubmit.test.tsx`, `pages/BookingFlowNavigation.test.tsx`, `BookingCompletePage.test.tsx`, `test/BookingCreationFlow.integration.test.tsx` |
| [#281](https://github.com/K4RF/reservation-platform/issues/281) | #271/#274/#275 | 내 예약 여행 카드/저장 상세/변경/취소 확인 | `pages/MyReservationsPage.test.tsx`, `ReservationDetailPage.test.tsx`, `components/reservation/ReservationChangeConfirmation.test.tsx`, `ReservationCancellationSubmit.test.tsx`, `test/ReservationManagementFlow.integration.test.tsx` |
| [#282](https://github.com/K4RF/reservation-platform/issues/282) | #271/#274 | 목적 중심 Auth/접근 안내/탐색 복귀 | `pages/LoginPage.test.tsx`, `SignUpPage.test.tsx`, `OAuth2CallbackPage.test.tsx`, `state/AuthProvider.test.tsx`, `test/AuthenticationFlow.integration.test.tsx` |
| [#283](https://github.com/K4RF/reservation-platform/issues/283) | #271/#274/#276 | ADMIN 탐색/조회/편집/결과, 도메인별 복구 | `pages/admin/AdminAccommodation.test.tsx`, `AdminRoom.test.tsx`, `AdminDailyPrice.test.tsx`, `AdminInventory.test.tsx`, `test/AdminManagementFlow.integration.test.tsx` |
| [#284](https://github.com/K4RF/reservation-platform/issues/284) | #277–#283 | 사진 있는 실제 정상 화면·격리 HTTP·전체 회귀·f0.6 인계 | 기존 4개 Lifecycle integration Suite + fine-grained Suite 재사용 |

표의 같은 디렉터리에서 연속하는 짧은 파일명은 앞 경로와 같다. 새로운 전체 Lifecycle Suite를 중복 생성하지 않는다.
DOM 재구성에 따른 선택자/문구 검사는 새 의미 구조에 맞추되 요청 횟수·Focus·gate·상태 전이 검증을 삭제하지 않는다.
`test/uiSemantics.ts`의 구조 Guard도 옛 DOM을 동결하는 디자인 승인이 아니다.
동적 상태 class를 추적한 뒤 미사용 CSS를 제거한다.

## 8. 공통 보존 계약·검증·완료 기준

1. URL/Back/Forward/원본 검색 Query/문서 수명의 Scroll·Focus, 최소1박/총 인원만 유지한다.
   대표 투숙객/Token을 URL·지속 Storage에 넣지 않는다. Room/Accommodation ID 검증 및 로그인 후 fresh Availability 필수.
2. 소유권/ADMIN은 Backend가 최종 경계다. 생성/변경/취소/Admin 쓰기 **401 포함 자동 replay 금지**,
   submit gate·불명 결과 잠금·fresh GET/명시적 검토를 보존한다. abort가 서버 rollback이라는 뜻은 아니다.
3. 키보드 Enter/Space/Tab/Escape, 레이어 Focus 진입/복귀·필요한 trap·배경 접근/scroll 복구를 검증한다.
   Sticky/Fixed는 정상 목표이며 safe-area/실측 CTA 높이만큼 본문 여백·scroll-margin을 확보한다.
   짧은 높이/가상 키보드/320px/확대에서는 레이어 내부 스크롤·재배치로 같은 행동을 제공하고 Focus/오류를 가리지 않는다.
4. 문서 overflow:hidden으로 실패를 숨기지 않는다. 요금/재고 표만 이름 있고 키보드 접근 가능한 내부 스크롤을 허용한다.
   긴 이름/이메일/예약번호, Loading/Error/Empty, Media 없음/부분 실패가 데이터·선택·입력 상태를 훼손하지 않아야 한다.
5. 각 화면의 **실제 1440/390 전체 페이지 + 같은 위치 Viewport**를 원본 앱 원점과 맞춰 나란히 비교한다.
   Studio/시연 UI를 제외하고 Header/Hero/닫힌 검색/첫 결과/Gallery/CTA의 위치·비율·밀도 차이를 기록한다.
   원본/실제 Viewport 높이·client 폭·날짜·소스 SHA·스크롤 위치·데이터 출처를 함께 적는다.
   정상 Media 있음/없음/실패를 각각 촬영한다. 이미지 없는 화면만으로 전체 재구성 완료를 보고하지 않는다.
6. 모든 큰 차이에 `원본 → 현재 → 목표 → 실제 결과 → 남은 차이/이유`를 남긴다.
   접근성 예외는 실제 키보드/Focus/겹침 증거와 동등한 대안을 제시한다. 긴 폼/빈 슬롯/반복 경고가
   정상 주요 콘텐츠를 밀어내면 다시 구조를 수정한다. 데이터·사진·주요 배치 선행이 남으면 해당 전체 화면을 완료로 닫지 않는다.

### 자동·Browser·HTTP 경계

Frontend 변경 시 `frontend/`에서 아래 기존 CI 명령을 실행한다. 관련 Suite를 먼저 실행하고 전체로 확인한다.

```powershell
pnpm test
pnpm lint
pnpm typecheck
pnpm format:check
pnpm build
```

DOM/HTTP Mock 성공은 실제 Backend/사진 저장/Google/Redis/사용자 시각 승인이 아니다.
[기존 UI Audit](../../frontend/scripts/ui-audit/README.md)은 격리 Fixture의 읽기/표현 확인 도구이며
실제 HTTP 업로드·쓰기 검증이나 제품 Media 데이터의 대체물이 아니다.
#276/#284는 격리 환경에서 실제 Media 업로드→공개 목록/Gallery→Login 후 가용성→예약/내역 흐름을 확인한다.
개발 DB/Volume을 삭제하거나 실계정/운영 파일을 테스트에 쓰지 않는다.
의존성·실행 설정 변경이 있으면 GitHub Actions의 버전/서비스/env/빌드와 함께 검토한다.

### #271 인계 범위

이 명세·선행/수용 기준·문서 진입점 연결이 #271의 산출물이다. 이번에는 화면/의존성/실행 설정을 변경하지 않는다.
2026-10-29 원본 Browser 실측은 새 관찰이고, #260 캡처/테스트는 과거 증거로 보존한다.
후속 구현의 실제 Media·전체 화면 재현도·실제 HTTP·원격 CI·최종 사용자 검수는 각각 별도로 보고한다.

### #271 실행한 검증 (2026-10-29)

| 항목 | 결과 / 한계 |
| --- | --- |
| 원본 A1/Search/Detail Browser, 각 1440/390 | CSS/DOM 실측 및 원본 캡처·#260 과거 캡처와 현재 소스 대조. 제품 화면 변경/새 구현 검증은 아님 |
| `pnpm test` | 76 files / 1,103 tests 통과. 기존 DOM/HTTP Mock 회귀 |
| `pnpm lint`, `pnpm format:check`, `pnpm typecheck`, `pnpm build` | 모두 통과. 첫 format 검사에서 변경 README 표가 지적되어 기존 Prettier로 정리 후 재검사 통과 |
| 문서 검사 | 변경 문서 5개의 로컬 링크 145개 존재 확인, `git diff --check` 통과 |
| GitHub Actions 검토 | `.github/workflows/frontend-ci.yml`의 같은 검증 명령 확인. 의존성/lockfile/env/워크플로 변경 없음 |
| 환경/미실행 | 로컬 Node 24.14.0 / pnpm 11.19.0, CI Node 24.19.0 / pnpm 11.19.0. 원격 CI·새 frozen install·Backend test/build·실제 HTTP는 이번 문서 변경에서 미실행 |

원본 실측을 위해 사용한 computer-use는 문서 수치 확인에만 영향을 주었다. 새 UI나 Media 구현을 추가하지 않았다.
