# #279 Detail Browser 증거

2026-11-04, `develop 783760c` 기반 실제 React/CSS를 격리 Audit에서 확인했다.
비교·상태 계약·차이/한계·테스트는 [보고서](../../frontend-detail-rebuild-279.md)를 따른다.
숙소·사진·요금·Auth role은 전부 가상 Fixture다. 실제 Backend HTTP/인증/실매물 근거가 아니다.
사진은 [기존 시안 자산](../../prototypes/premium-travel/ASSETS.md)을 Audit에서만 제공한다.
새 이미지 생성/프로덕션 자산 복사/개발 DB 업로드는 없다.

## 재현

저장소 루트에서 각각 별도 터미널로 실행한다.

```powershell
cd frontend
node scripts/ui-audit/server.mjs
```

```powershell
cd docs/ui/prototypes/premium-travel
node serve.cjs
```

- 원본: `http://127.0.0.1:5174/__reference/index.html?view=detail&palette=navy`
- 비교 보드: `http://127.0.0.1:4381/review.html`
- 제품: `http://127.0.0.1:5174/?path=%2Faccommodations%2F7&media=present`
- 선택: path를 `/accommodations/7?checkInDate=2030-01-01&checkOutDate=2030-01-03&guestCount=2`로 URL 인코딩한다.
  `role=USER`는 Audit 전용 서명 없는 UI Hint다. 객실 선택→확인 링크→계속은 명시적 UI 조작이다.
  실제 예약 POST는 실행하지 않는다. 도구의 모든 쓰기는405로 차단된다.
- `media=missing` / `partial` / `failed`: 미제공 / 두 번째 파일404 / 모든 파일404.
- `scenario=empty`는 가용 객실0, `error`/`loading`은 상세 실패/대기다. Loading은 약10초 Timeout 전 캡처다.
- `scenario=stress`: 공백 없는 긴 제목/이름/주소/alt와 큰 기본가. 실매물/Backend 한계 검증이 아니다.
- `textScale=200`은 root/rem 확대다. 390×420은 짧은 화면 탐침이며 실기기 키보드가 아니다.

## 파일 지도

| 파일                                                                         | 내용                                                           |
| ---------------------------------------------------------------------------- | -------------------------------------------------------------- |
| reference-{1440,390}.jpg / -full.jpg                                         | Studio/demo UI 제외 원본 첫 화면/전체                          |
| implementation-{1440,390}.jpg / -full.jpg                                    | 정상 사진, 날짜 미적용·카탈로그 객실1개                        |
| selected-{1440,390}.jpg                                                      | 날짜 적용·선택 후 Rail/하단 행동                               |
| room-modal-{1440,390}.jpg                                                    | fresh Room GET의 Modal/Sheet                                   |
| gallery-{1440,390}.jpg                                                       | Desktop 두 번째 사진 / Mobile 전체 보기                        |
| last-control-focus-390.jpg                                                   | 마지막 선택 해제 조작의 Focus 가림 방지                        |
| condition-apply-focus-390.jpg                                                | 조건 적용 후 카탈로그 전환·선택 해제·새 인원 Trigger 초점 복귀 |
| booking-boundary-390.jpg / booking-errors-390.jpg                            | 명시적 계속 후 별도 입력 / 빈 입력 오류                        |
| long-320.jpg / long-name-200-390.jpg                                         | 긴 문자열/복귀, 확대된 선택·고정 행동                          |
| short-200-390.jpg / short-calendar-200-390.jpg / short-error-200-390.jpg     | 낮은 높이·확대의 일반 흐름 CTA/날짜 Dialog/검증 오류           |
| media-partial-1440.jpg / media-missing-1440-full.jpg / media-missing-390.jpg | 부분 실패/미제공                                               |
| media-failed-390.jpg / room-photo-failed-390.jpg                             | Gallery 대표/Room 파일 실패                                    |
| availability-empty-390.jpg / detail-error-390.jpg / detail-loading-390.jpg   | 빈 가용성·상세 오류/대기                                       |
| measurements.json                                                            | 최종 정상 시작 위치 DOM rect/사진 상태/Viewport                |
| states.json                                                                  | 개발 중 선택/레이어/초점/scroll lock/확대/오류 Browser 관찰    |

정상 비교 Viewport는1440×900/390×844, scrollY=0이다. 원본 소스/CSP는 변경하지 않고
기존 외부 capture CSS로 Studio/demo 안내/상태 도구만 제외했다. 사진 로드 후 Footer→Home으로
돌아와 Viewport/전체 순서로 저장했다. Mobile의 숨긴 두 번째 mosaic 사진은 lazy 로드하지 않아도 전체 보기에서 읽을 수 있다.
원본 객실2개와 제품1개, 기본 일정 차이를 포함하므로 전체 높이는 pixel golden이 아니다.
스크린샷 export는 스크롤바 제외/리샘플링/full-page 재배치가 있어 파일 px와 CSS px를 구분한다.
full-page의 fixed CTA는 캡처 당시 Viewport 위치에 보이며 문서 중간에 새 CTA가 추가된 것이 아니다.

Audit는 MemoryRouter다. 앱 내부 Room Modal의 history/닫기와 명시적 상세 복귀는 동작하지만,
주소창 path는 초기값이다. native Browser Back/Forward·실제 HTTP는 별도 검증이다.
실행 종료는 두 터미널 Ctrl+C다. 실제 DB/Redis/storage는 필요 없고 건드리지 않았다.
