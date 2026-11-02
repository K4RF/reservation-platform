# 실제 Media 연결·Gallery·ADMIN 사진 관리 (#276)

2026-11-03(Asia/Tokyo). 최신 `develop` `e12df39`(PR #289, #275)에서
`feature/#276-catalog-media-integration`를 생성했다. #271 명세·승인 기준·A1/Navy & Ivory,
Search/Detail 원본과 선행 #272/#273/#275의 소스·테스트를 확인했다.
사용자 시각 승인이나 새 f0.5.3 전체 화면 완료 선언이 아니다.

## 연결한 계약과 책임

- `api/media.ts`: 공개 Media의 ID/URL/alt/크기/MIME/순서/중복/대표 일치를 검증한다.
  목록은 최대1장, 상세는20장이다. 누락된 계약을 정상 사진 없음으로 숨기지 않는다.
  실제 무사진 응답인 `representativeImage:null, images:[]`는 지원한다.
- DTO URL은 정확한 `/api/v1/media/{mediaId}/content`만 허용한다. 외부/data/javascript/
  protocol-relative URL, 다른 ID, query 주입을 거부한다. img src는 기존
  `VITE_API_BASE_URL` prefix로 해석하므로 별도 Media 환경변수/Secret이 필요 없다.
  alt/출처는 React text로 출력하고 HTML을 삽입하지 않는다.
- `CatalogImage`: 실제 파일·원본 width/height·고정 비율·cover/center 크롭·loading/error/empty.
  없음은3rem 수준의 짧은 대체 안내다. 파일 실패는 해당 이미지 영역만 대체하며
  다른 대표로 자동 바꾸거나 API/예약을 다시 호출하지 않는다. URL 교체는 오류 상태도 초기화한다.
- `CatalogGallery`: 숙소는 Desktop 1.8:1 비대칭 사진, Mobile 대표+전체 보기다.
  순서대로 탐색하는 native modal/Sheet는 #275 `SearchLayer`의 잠금/초점 정리를 재사용한다.
  큰 사진은 contain으로 전체를 확인할 수 있다. Room 사진은 **기존 객실 Dialog 내부**에서
  탐색하며 중첩 Modal이나 선택/쓰기 동작을 만들지 않는다.
- Search 카드·Room 카드/상세는 기존 응답만 사용한다. 카드별 Media/Room 추가 GET은 없다.
  Home은 안내 카드 대신 ACTIVE/ID ASC/첫 페이지/최대2개인 유한 공개 catalog 읽기를 연결했다.
  인기/추천 점수나 가격 집계가 아니다. 이후 Home 구성 완성은 #277이다.

Detail 첫 핵심 이미지/Search 첫 카드는 eager/high, 나머지 카드는 lazy다.
Home은 브랜드 Hero만 우선하고 하단 catalog는 첫 장도 lazy다. Browser의 lazy 임계 거리는
구현별로 달라 가까운 하단 사진이 일찍 다운로드될 수 있다.
현재 Backend에는 **단일 저장 파일만 있고 rendition/srcset 후보가 없다**. 가짜 썸네일 URL이나
여러 해상도라고 속이는 후보를 만들지 않았다. 반응형 CSS/비율/원본 치수를 제공하지만
실제 파생 후보·CDN/압축 최적화는 별도 계약이 필요하다. 최대10MiB 원본 비용도 남아 있다.

## ADMIN: 명시적 한 번 쓰기와 실패 복구

기존 숙소/객실 편집 페이지에 사진 관리 이동 링크와 `MediaManager`를 연결했다.
대상 catalog/Room→Accommodation 소속을 확인한 뒤 **명시적 ADMIN album GET**을 연다.
기존 page-level `useAdminMutation`과 잠금을 공유하며 별도 복제된 Auth/쓰기 client는 없다.

1. 조회의 ownerType/ownerId·정렬·최대20장과 강한 ETag/revision 일치를 검증한다.
2. 추가, 설명/출처/권리 수정, 대표 지정, 전체 순서, 파일 교체, 삭제 중 하나를 선택한다.
   순서의 ‘앞으로’ 버튼은 draft만 바꾼다. 대상 변경 시 파일/동의가 초기화된다.
3. JPEG/PNG·10MiB 사전 검증, alt/출처/권리 길이 검증 후 새 동의로 한 번 제출한다.
   실제 decode·8192px/16M픽셀·소속·권한·20장 제한은 서버가 최종 검증한다.
4. 관리 GET의 따옴표 포함 ETag를 If-Match로 보낸다. multipart는 file + application/json
   metadata Blob이며 boundary는 Browser가 만든다. 모든 쓰기는401 포함 자동 replay 금지다.
5. 저장 중 indeterminate progress와 중복·다른 catalog/정책 저장 잠금을 제공한다.
   성공 응답 뒤에도 새 ADMIN GET/ETag를 받아야 준비 상태로 돌아간다.
6. **모든 사진 작업 실패**(409 포함), 또는 저장 성공 뒤 GET 실패는 입력/직전 작업을 남기고
   page 쓰기를 잠근다. 같은 owner의 새 GET → ID/사진/순서/metadata 대조 → 결과 확인 체크 →
   ‘새 작업 준비’를 거쳐야 한다. 새 ETag만 받았다고 잠금을 해제/재전송하지 않는다.

단일 파일 작업만 지원하므로 batch 부분 성공을 추측하지 않는다. 서버 commit 뒤 응답 유실,
성공 뒤 GET 실패, DB 삭제 뒤 물리 파일 정리 대기를 구분한다. 교체는 새 ID/URL이고 삭제 후
다음 이미지가 대표다. 물리 cleanup 실행 UI·숙소/객실 삭제·자동 retry는 추가하지 않았다.
페이지/세션/owner 변경 후 늦은 응답은 무시한다. 사진 성공이 다른 catalog 폼의 미제출
draft를 지우지 않도록 부모 폼 전체를 재마운트하지 않는다.

public 화면은 이동/재진입 시 기존 GET으로 새 대표를 읽는다. Gallery/이미지 클릭·실패는
URL/가용성/객실 선택을 바꾸지 않는다. 로그인 후 fresh availability, 변경·취소/ADMIN gate,
대표 투숙객·Token 비노출을 유지한다. 다른 탭의 자동 실시간 갱신은 제공하지 않는다.
Backend Redis eviction의 TTL/장애 한계는 [기존 계약](../architecture/catalog-media.md)을 따른다.

## 시안 대응·실측·미완료 화면

[새 캡처](evidence/276/README.md), [원본](prototypes/premium-travel/review.html),
[Home/Search 원본 비교 캡처](evidence/275/README.md). 실제 React/CSS를 사용하지만
Browser 사진은 **격리 Audit fixture**다. 시안 PNG를 실제 시설 사진으로 등록하지 않았다.

| 영역 | 원본 → 기존 → 이번 결과 → 남은 차이 |
| --- | --- |
| Home | 사진 탐색 → 01/02/03 안내 → 실제 최대2개 catalog 대표 연결. Hero/Bar는 #274/#275 유지. 비대칭 탐색 구성/카피 완성은 #277 |
| Search | 사진 H240/250 → 큰 무사진 슬롯 → 실제 사진 약236.5/246.75px(1440/390), 무사진은 짧은 안내. 첫 카드 Y약712/912는 아직 원본 목표470–500/520–560보다 늦으며 필터/정렬 밀도 재구성은 #278 |
| Detail | 비대칭 H455/350 → 단일 무사진 영역 → 실제 H455/350, Desktop W1311·1.8:1, Mobile W331 대표+전체 보기. 시작 Y404.5/338.5로 원본 시연행 제외 참고316/260보다 늦다. 제목/위치/본문·단일 객실/Rail/고정 CTA는 #279 |
| Room | 사진+비교 → 무사진 카드/Dialog → 실제 대표/상세 사진, 원래 fresh GET/소속/선택 계약 유지. Bed/Size/View/Description은 발명하지 않음 |
| ADMIN | #271 제품 제안 → 기존 catalog 폼 → 명시적 album 조회/편집/복구 추가. 전체 작업 공간 재구성은 #283 |

1440×900,390×844에서 정상 사진 full-page/viewport를 저장하고, 없음·실패·부분 실패도
각각 확인했다. 문서 가로 넘침은 없었다. Mobile crop은 center이며 원본의63%와 다르다.
새 focal-point metadata를 추측하지 않고 전체 보기의 contain을 동등한 확인 경로로 제공한다.
긴 alt/320×568/root font200%에서는 내부 스크롤로 모든 조작에 도달한다. 마지막 사진으로
이동해 다음 버튼이 disabled될 때 초점이 body로 빠지던 문제를 발견해 사용 가능한 인접
버튼으로 복귀하도록 수정했고 Browser/DOM 회귀로 확인했다.

Home 성능 probe 한 샘플은 지원된 LCP/resource entry와 약2.46MB PNG 전송을 관찰했다.
그 구간에 layout-shift entry는 없었지만 이를 표준 CLS0점/최종 LCP/실기기 성능 보장으로
해석하지 않는다. 고정 frame/원본 치수로 파일 성공·실패 후 사진 공간을 유지한다.

## 검증과 실행

Frontend 기존 lifecycle suite를 확장했다. 새 전체 lifecycle suite를 중복 생성하지 않았다.
공개 URL/정렬/대표/projection/ETag/multipart/401 no-replay, 읽기 전 gate, 중복/다른 쓰기 잠금,
409/500과 후속 GET 실패 복구, stale owner, 사진 실패 후 선택 유지, ADMIN 작업 후
Home/Detail 공개 재조회까지 검증한다. 새 다단계 Media lifecycle 한 케이스만15초 timeout을
사용한다(여러 직렬 쓰기+GET+route 전환). 테스트 비활성화/삭제나 production retry가 아니다.

```powershell
cd frontend
pnpm test
pnpm lint
pnpm typecheck
pnpm format:check
pnpm build
pnpm exec tsc -p scripts/ui-audit/tsconfig.json
node --check scripts/ui-audit/server.mjs
cd ../backend
.\gradlew.bat test --tests '*MediaManagementMySqlIntegrationTest'
```

- 실제 HTTP: 기존 MySQL8.4/Redis7.4 Testcontainers·random TCP port·임시 storage의
  `MediaManagementMySqlIntegrationTest` **4 tests / failures0 / errors0 / skipped0**, BUILD SUCCESSFUL.
  ADMIN 테스트 JWT와 합성 픽셀로 upload→public bytes→metadata→replace→old URL404→delete,
  Room 분리/캐시/경합/파일 참조 보존을 재확인했다. 개발 DB/Volume/실계정/사진 수정 없음.
- Frontend 최종 전체 결과: **80 files / 1,151 tests / failures0**, lint/typecheck/
  format:check/build 성공. Audit 별도 TypeScript와 server.mjs syntax 검사도 성공했다.
  Production 빌드에 Audit PNG/fixture 경로를 포함하지 않았다.
- Frontend DOM/HTTP Mock, Browser fixture, 위 실제 JDK HttpClient 테스트는 별개다.
  **실제 Browser에서 Frontend multipart client→Backend까지 이어지는 업로드 E2E는 미검증**이다.
  따라서 이슈를 자동으로 닫거나 전체 실제 연동/사용자 승인이 완료됐다고 보고하지 않는다.
- 실제 기기 키보드·native zoom·화면낭독기·시설 사진/권리 검토·다른 origin CORS는 별도다.
  root font200%는 native zoom을 대신하지 않는다.
- 의존성/lockfile/Backend 실행 설정/필수 환경변수 추가 없음. 기존 Frontend CI의
  Node24.19.0/pnpm11.19.0/frozen install 및 lint/format/typecheck/test/build를 검토했다.
  로컬 Node24.14.0/pnpm11.19.0이며 원격 Actions는 실행하지 않았다.

실행 시 Backend #272/#273과 DB/파일 저장소가 준비돼 있어야 한다. `frontend/.env.example`의
기존 API prefix/proxy를 그대로 사용한다. Backend `MEDIA_STORAGE_ROOT`는 기존 설정이다.
별도 origin 구성은 Authorization/If-Match/Content-Type을 허용하고 ETag를 expose하는 CORS가
필요하다. 현재 기본 same-origin Vite proxy 방식에는 별도 CORS 변경이 없다.
관리 페이지에서 실제 대상 조회→사진 관리→작업 선택/사용권 확인→한 번 제출한다.
실제 사진은 소유자 제공/사용 허가 확인 자료만 사용한다. 위 시안 이미지를 실매물에 올리지 않는다.
