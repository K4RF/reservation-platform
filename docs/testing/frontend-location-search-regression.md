# 지역 검색 통합 및 회귀 검증 (#321)

기준 `develop`: `f7b1ca3` (#320 병합). 테스트 실행기와 문서만 변경했습니다.
운영/공유 개발 DB·Volume·계정은 사용하지 않았습니다. 외부 지도·Google OAuth·PG는 검증 범위가 아닙니다.

## 재현

[격리 실행 절차](frontend-backend-integration.md)에 따라 Backend JAR와 Frontend 의존성을 준비한 뒤
저장소 루트에서 실행합니다.

```powershell
node scripts/integration/run.mjs --locations --booking --hold
```

`--locations`는 기존 공통 스모크와 `--booking` 검증이 끝난 뒤 이 실행의 MySQL에만 지역 fixture를 추가합니다.
기존 숙소 외에 서울 강남구 중복, 부산 해운대구, 다른 도시·국가의 동명 지역, 비활성 지역,
주소만 있는 행, 도시만 구조화된 행과 상한 검증용 12개 지역을 준비합니다. SQL CLI는 UTF-8로 고정합니다.
별도 Browser 로그인에는 기존 절차대로 실행별 임시 비밀번호를 사용합니다. `--hold`에서 Enter를 누르면
성공한 실행의 자원만 정리합니다. 자동 HTTP만 실행하려면 `--hold`를 생략합니다.

## 실제 HTTP 및 MySQL

- 브라우저 프록시와 같은 경로의 `GET /api/v1/accommodations?destination=…`에서 `서울`, `서울특별시`, `부산`,
  `강남`, `해운대`, 유니코드 공백이 섞인 복합 입력, 없는 지역을 조회하고 생성된 fixture ID와 대조했습니다.
- `GET /api/v1/accommodations/locations/suggestions?q=…`의 도시/하위 지역 순서, 중복 제거, 고정 상한 10개,
  빈 값·한 글자·없는/비활성 지역 및 과길이 400을 확인했습니다. 동명 지역의 `searchParams`를 그대로 보내면
  국가와 부모 도시가 정확히 구분됩니다. 후보는 레거시 주소를 추정하지 않습니다. 관리자 기존 `city/region`은
  국가 필터 없이 기존의 NULL 지역 주소 매칭을 유지했습니다.
- 선택 지역에 기간·인원·객실 편의시설·정렬을 붙인 검색과 별도 가용 객실 GET을 대조했습니다. 인원 초과는 빈 결과,
  `size=1&page=1`은 기대한 다음 숙소를 반환했습니다. 공통 스모크의 예약 생성/변경/취소 및 `--booking`의
  적용 가격, 마지막 재고 충돌도 성공했습니다.

## Chromium과 자동화의 경계

실제 Vite → Spring Boot → 격리 MySQL 연결에서 아래를 확인했습니다. 디자인은 승인된 Navy & Ivory 검색창 기준이며,
검증용 캡처는 Git에 넣지 않았습니다.

- 1440×1000 Home에서 `서` → `서울`을 입력하고, 같은 이름의 도시·지역 중 대한민국/서울의 강남구를 선택했습니다.
  실제 주소는 `country=대한민국&city=서울특별시&region=강남구&status=ACTIVE`를 포함했습니다. Home 기본 인원 1명
  조건으로 객실을 준비한 서울 숙소 한 곳이 나왔고 새로고침 후에도 동일했습니다. `부산` 자유 검색에서는 기존
  인원 조건이 남아 객실 없는 부산 fixture를 제외했습니다. Back/Forward에서 두 조건과 결과가 각각 복원됐습니다.
- 390×844 Search에서 인원 조건 없이 `부산`을 입력하고 후보를 Escape로 닫은 뒤 Enter로 자유 검색했습니다.
  URL의 `destination=부산`과 실제 부산 숙소 한 곳을 확인했습니다. 두 폭에서 가로 넘침은 관찰되지 않았습니다.
- 390px에서 날짜·2명·WIFI·이름 역순을 포함한 정확 검색 링크를 열었습니다. 상세의 실제 가용 객실 및 검색 복귀 후
  카드 포커스 복원(관찰 스크롤 249px)을 확인했습니다. 일회용 이메일 로그인 뒤 원래 `search`와 객실이 복원됐고,
  가상 투숙객으로 한 번 제출한 결과 소유자 완료 화면 및 격리 MySQL 모두 `CONFIRMED`, 2박, `20000.00`을 보였습니다.
  해당 객실/기간에 저장된 예약은 한 건이고 nightly snapshot은 두 건이었습니다. 완료 직전 브라우저 콘솔 오류는 없었습니다.
- 로딩·빈 후보·네트워크 오류의 시각 상태와 입력 포커스·가로 넘침은 별도 UI Audit fixture로 1440/390에서 재현했습니다.
  한글 조합 이벤트, abort 후 응답 역전, 키보드·터치 타입 이벤트와 제출 가드는 기존 Vitest에서 확인했습니다.
  실제 OS IME, 물리 터치·모바일 키보드·스크린리더, 실제 네트워크 오류·응답 역전은 이번 실행에서 재현하지 않았습니다.
  브라우저에서는 주소·화면으로 조건을 관찰했고 요청/응답 계약은 실제 HTTP 스모크로 별도 확인했습니다.

## 검증 명령과 성능 한계

- Backend Wrapper 관련 테스트 24개, 전체 `gradlew.bat build`에서 테스트 364개(실패/스킵 0).
- Frontend 검증과 원격 CI의 상세 결과는 이번 PR의 테스트 결과 및 Checks를 기준으로 합니다.
- 실제 MySQL 8.4 재실행에서 [후보 SQL](../architecture/accommodation-location-suggestions.md)은 입력당 SELECT 1회,
  도시/지역 분기 `ALL` + `Using filesort`, 파생 결과 `ref` + `Using filesort`였습니다. 자유 입력 전용 표본은
  [기존 실행 계획 테스트](../performance/search-query-execution-plan.md)에서 `PRIMARY` 인덱스 스캔 + `Using where`였습니다.
  부분 일치의 선행 `%`는 범위 검색을 보장하지 않으며, 반환 상한은 스캔·정렬 비용 상한이 아닙니다. 운영 데이터의
  지연 시간·부하 목표, 지명 마스터나 같은 전체 튜플의 실제 위치 구분은 검증/구현하지 않았습니다.
