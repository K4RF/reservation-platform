# #278 Search Browser 증거

2026-11-03~04, `develop 6fb7055` 기반 #278 변경을 IAB에서 확인했다.
비교/수치/테스트/차이는 [보고서](../../frontend-search-rebuild-278.md)를 따른다.
모든 숙소·사진·금액은 시안/격리 Fixture이며 실매물·실제 Backend HTTP 검증이 아니다.

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

- 원본 Search: `http://127.0.0.1:5174/__reference/index.html?view=search&palette=navy`
- 검토 보드: `http://127.0.0.1:4381/review.html`
- 제품: `http://127.0.0.1:5174/?path=%2Faccommodations&scenario=comparison&media=present`
- Sheet/페이지 복귀: path를 `/accommodations?city=서울특별시&name=호텔&roomAmenities=WIFI&size=2`로 URL 인코딩한다.
- Media: 제품 URL의 media를 `missing` / `partial`로 변경한다.
- 목록 상태: scenario를 `loading` / `error` / `empty`로 변경하고 path에 city를 유지한다.
- 긴 내용: scenario=`stress`, media=`present`, Viewport320. 카드의 소개·주소를 펼친다.
- 글자 확대: `textScale=200`, Viewport390×420. 필터에서 min200/max100으로 적용 후 키보드 접근한다.

비교 Viewport는 1440×900 / 390×844, 시작 scrollY=0이다. 원본의 Studio/demo 안내/상태 도구만
외부 capture CSS로 숨긴다. 원본 소스/CSP는 변경하지 않는다. End/Home으로 lazy 사진 로드를 확인하고
Viewport → full-page 순서로 캡처했다. 실제 UI의 Filter/Navigation/사진/링크는 숨기지 않았다.
파일 export는 스크롤바 제외/리샘플링/재배치가 있어 파일 px와 CSS px를 동일시하지 않는다.
원본은4개, 기본 ACTIVE 제품은3개이므로 전체 페이지 높이를 동일 데이터의 golden으로 보지 않는다.

## 파일

| 파일                                                        | 내용                                                   |
| ----------------------------------------------------------- | ------------------------------------------------------ |
| reference-{1440,390}.jpg / -full.jpg                        | demo UI를 제외한 원본 첫 화면/전체                     |
| implementation-{1440,390}.jpg / -full.jpg                   | 정상 Media·첫 화면/전체                                |
| filter-sheet-390.jpg                                        | 기존 조건을 보존한 모바일 필터                         |
| filter-invalid-390.jpg / filter-action-focus-390.jpg        | 검증 오류 초점 / Tab으로 적용 접근                     |
| filters-applied-390.jpg                                     | 명시적 적용 후 결과 도구/필터 요약                     |
| filter-short-200-390.jpg / filter-short-error-200-390.jpg   | 420px 높이·200% root 글자·버튼/오류 접근               |
| media-missing-{1440,390}.jpg / media-partial-{1440,390}.jpg | 미제공 / 두 번째 파일 실패                             |
| catalog-{empty,error,loading}-390.jpg                       | 적용된 도시 조건을 유지한 상태 표시                    |
| unsent-conditions-390.jpg                                   | 미제출 도시 초안과 기존 결과 조건 안내                 |
| return-cta-390.jpg                                          | Detail 화면의 복귀 링크로 원래 CTA 위치/초점 복원      |
| long-expanded-320.jpg                                       | 긴 이름·전체 소개·상세 주소를 펼친 320px 전체          |
| measurements.json                                           | 정상 원본/구현 DOM rect·열·사진 상태·Viewport          |
| states.json                                                 | 키보드/취소/적용/resize/복귀/폭/짧은 화면 Browser 관찰 |

Audit는 MemoryRouter를 사용한다. 실제 내부 링크는 동작하지만 주소창 path는 초기값이며,
native Back/Forward/실제 HTTP/실기기 키보드의 E2E 증거로 보고하지 않는다.
초안 preview/취소의 무요청·API Query/쓰기 횟수는 기존 DOM Mock 테스트에서 검증한다.
comparison은 status 이외 필터/정렬을 실제로 적용하지 않는다. 파일404는 의도적 Media 실패다.
서버 종료는 각 터미널 Ctrl+C이며 운영 앱/개발 DB/storage를 변경하지 않는다.
