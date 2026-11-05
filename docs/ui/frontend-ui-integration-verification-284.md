# 승인 시안 재현도 및 실제 연결 검증 (#284)

2026-11-05~06 · 기준 `develop` `6ada20d` (#283 병합) · 새 f0.5.3 (Milestone #21).
검증 대상은 [#271 수용 기준](prototype-rebuild.md#4-원본-대응-화면의-실행-명세)과
[승인 원본](approved-design.md)의 **Home A1 / Navy & Ivory / Search / Detail**이다.
Booking·내 예약·Auth·ADMIN은 #271의 제품 구성안으로 검증했으며 승인 원본 화면과 혼동하지 않는다.

## 화면 비교

[1440/390px 동일 위치 Viewport와 전체 페이지 대조표](evidence/284/README.md).
시안의 Studio·데모 컨트롤을 빼고 첫 Viewport를 비교했다. 제품은 실제 라우트/컴포넌트를
별도 Browser HTTP Fixture로 실행했다. 같은 출처의 AI 사진을 사용하고 Search/Detail의
일정은 2030-01-01~03, 인원은 2명으로 맞췄다. Home은 실제 제품의 초기 빈 일정·지역을 유지했다.
픽셀값은 스크롤 0에서 측정한 CSS px이며 **시안 → 제품**, Y는 문서 위에서부터의 위치다.

| #271 목표 | 1440px | 390px | 확인한 차이 |
| --- | --- | --- | --- |
| Home: overlay Header, Hero 내부 검색, 사진 탐색 | Header 높이 94 → 94, Hero 740 → 740. 검색 Y 598 → 594 / 높이 90 → 94. 첫 사진 Y 982 → 987 / 높이 360 → 360 | Header 72 → 72, Hero 720 → 720. 검색 Y 480 → 475 / 높이 188 → 191. 첫 사진 Y 941 → 907 / 높이 290 → 290 | 데스크톱 비대칭 2열, 모바일 1열. 사진은 카탈로그 조회 결과이며 추천/가격 순위가 아니다. 모바일에서 사진이 34px 일찍 시작한다. |
| Search: compact 조건, 결과 수/정렬, 2열 카드 ↔ 1열·필터 Sheet | 검색 Y 307 → 296 / 높이 90 → 94. 첫 카드 Y 471 → 489, 사진 높이 240 동일, 카드 폭 479 동일 | 검색 Y 246 → 229 / 높이 188 → 191. 첫 카드 Y 516 → 508, 사진 높이 250 동일, 카드 폭 335 → 331 | 첫 카드 높이는 506 → 545 / 512 → 551. 실제 주소·설명·객실 CTA가 들어간다. 시안 4개와 Fixture 3개라 전체 길이는 직접 비교하지 않는다. |
| Detail: 비대칭 Gallery, 단일 객실 영역, Desktop Rail / Mobile 고정 CTA | Gallery Y 316 → 320, 높이 455·폭 1311 동일. Rail 폭 345 동일, Y 823 → 827 / 높이 417 → 471. 스크롤 시 Rail top 24 | Gallery Y 260 → 266, 높이 350·폭 347 동일. CTA Y 772 → 775 / 높이 72 → 69. 본문 안 Rail Y 2146 → 2400 | 제품은 이용 정보·일정·가격 조건까지 포함해 전체 2020 → 2257 / 2812 → 3096. Fixture 가용 객실은 1개, 시안은 2개. 모바일의 일정·객실 정보 밀도와 Rail까지의 이동량은 최종 검수에서 재확인한다. |

Home·Search·Detail 각각에서 [사진 있음, 없음, 요청 실패](evidence/284/README.md#상태와-레이아웃)를
비교했다. Gallery 실패·닫기는 객실을 선택하지 않고, 사진 없는 실제 Room은 대체 상태를 표시했다.
가용 객실과 읽기 전용 Room을 한 번에 쌓지 않는다. Search 조건·필터 미리보기와 상세 복귀,
Loading/Empty/Error·객실 선택 무효화는 #277–#279의 테스트와 최종 전체 회귀로 함께 확인한다.
시안의 가짜 가격·평점·할인·객실 사양과 Studio 조작부는 제품에 들어가지 않는다.

### 발견하고 수정한 동작

모바일 Detail에서 일정이 적용됐는데도 **객실 확인**을 누르면 목록보다 아래인 날짜 입력으로
포커스가 이동했다. 적용 전은 **일정 입력** → 일정 제목, 적용 후는 **객실 확인** →
가용 객실 제목으로 수정했다. 새 조회나 객실 선택 없이 포커스와 스크롤만 바뀐다.
유효한 객실을 선택한 뒤에는 기존의 명시적 **계속하기**를 유지한다.
[수정 후 캡처](evidence/284/detail-mobile-cta-focus-390.jpg)와 기존 Room Availability 테스트에 남겼다.

## 실제 Backend와 예약

시안 비교와 별도로, **Browser → Vite proxy → Spring Boot → MySQL 8.4 / Redis 7.4**
환경을 localhost에만 열었다. 검증 전용 MySQL DB와 미디어 루트, 임시 자격 증명을 사용하고
개발용 `.env`나 Compose DB를 읽거나 수정하지 않았다. Spring은 테스트 설정을 명시하고
MySQL/Redis·캐시를 연결했으며 Kafka는 끄고 실제 제품과 같은 업로드 제한
(파일 10MB / 요청 11MB)을 지정했다. 이 제한을 빠뜨린 최초 실행은 업로드가 실패했으며,
정상 설정으로 격리 서버를 재시작해 재현했다. 제품 설정은 변경하지 않았다.

- ADMIN 로그인 → 숙소 사진 2장과 Room 사진 1장 등록 → 최신 앨범에서 숙소 대표 변경 →
  Home·Search 카드 및 Detail·Room Gallery에서 실제 파일 확인.
- ADMIN 로그아웃 → 예약 문맥에서 일반 회원 이메일 로그인 → 로그인 후 가용 객실 재조회 및
  선택 복구 → Booking 검토 → 일회용 DB에 예약 1건 저장 → 완료·본인 목록·본인 상세에서 확인.
- 기존 `MediaManagementMySqlIntegrationTest`에 같은 HTTP 흐름을 추가했다.
  버전 조건을 사용한 대표 변경, 목록·상세 사진/실제 바이트, 일반 회원의 ADMIN 앨범 접근 거절,
  비로그인 예약 상세 조회 거절, 예약 후 재고 반영과 본인 조회를 확인한다.

[실제 Backend 연결 캡처](evidence/284/README.md#실제-backend-연결).
사진과 매물, 예약자는 모두 가상 검증 자료다. 실행 후 검증 전용 컨테이너와 파일을 제거했다.
사용자 Compose 및 기존 볼륨은 그대로다. 브라우저 경로는 사용자 동작을, 자동 HTTP 테스트는
응답/권한/재고를 검증한다. 화면 캡처를 요청 수나 성능의 증거로 사용하지 않는다.

## 키보드·반응형 및 회귀

- 390px에서 메뉴·날짜·인원·필터 Sheet를 Enter로 열고, 포커스 진입 및 Escape 후 원래 버튼으로의
  복귀를 확인했다. 모달의 스크롤 잠금이 닫힌 뒤 해제됐다. Gallery와 Room 모달도 각각
  자신을 연 사진/버튼으로 포커스가 돌아왔다.
- 320×568에서 긴 문구와 루트 글자 크기 200%를 적용해 세 화면 모두 문서 가로 스크롤이
  생기지 않았다. 390×420의 짧은 화면에서는 CTA가 정상 흐름으로 들어갔고, 날짜 레이어가
  화면에 들어왔다. 정상 390px에서 날짜 레이어를 열면 Fixed CTA가 숨겨졌다.
  실제 키보드·노치·브라우저 확대를 에뮬레이션한 것은 아니므로 기기 검수는 남아 있다.
- 기존 BookingCreation, ReservationManagement, AdminManagement, Authentication 네 통합
  Suite(45개)는 재사용했다. 중복 제출/401 재실행 금지, 불명 결과 잠금 및 조회 복구,
  접근 제어와 검색·가용 객실 복귀를 DOM/Mock으로 검증한다. 새 전체 Lifecycle Suite는 만들지 않았다.

| 검증 | 결과 |
| --- | --- |
| Backend `./gradlew test --tests '*MediaManagementMySqlIntegrationTest'` | Testcontainers 5개 통과 |
| Backend `./gradlew build` | 성공. 전체 355개 통과, 실패·스킵 0 |
| Frontend `pnpm lint`, `pnpm format:check`, `pnpm typecheck` | 통과 |
| Frontend `pnpm test`, `pnpm build` | 전체 80개 Suite, 1176개 테스트 통과. TypeScript 및 Vite 빌드 성공 |
| 원격 CI | 선행 #297의 [Frontend](https://github.com/K4RF/reservation-platform/actions/runs/42046165380/job/127309569895)·[Backend](https://github.com/K4RF/reservation-platform/actions/runs/42046165174/job/127309569585) 통과. #284는 로컬 브랜치이므로 원격 CI 미실행 |

Backend Media 선행 검증은 [공개 계약 #272](../testing/catalog-media-272.md)와
[관리자·파일 수명주기 #273](../testing/media-management-273.md),
프런트 연결 경계는 [#276](frontend-media-integration-276.md) 참고.
패키지·런타임·CI 설정 변경은 없다.

## f0.6.0 최종 검수 인계

- [비교 자료](evidence/284/README.md)에서 첫 화면뿐 아니라 Search 카드/필터 밀도, Mobile
  Detail에서 일정·객실·Rail까지의 이동량, Booking 및 내 예약의 읽는 순서를 확인한다.
- 서비스용 사진의 권리·해상도·크롭은 실제 자산으로 검수한다. 가격/통화·후기·Bed/Size/View는
  별도 계약 없이 채우지 않는다. AI Hero는 계속 장식 이미지로 표시한다.
- 실제 Mobile Safari/Chrome, 시스템 글자 크기·브라우저 줌·가상 키보드·노치 영역, 보조 기술,
  외부 Google OAuth, 실제 자산 전송 성능은 이번 증거에 포함되지 않는다.
  #284 PR의 원격 검증도 별도로 확인한다.
- 통과한 자동 검증과 격리 Browser 관찰은 **사용자의 최종 시각 승인**이 아니다.
