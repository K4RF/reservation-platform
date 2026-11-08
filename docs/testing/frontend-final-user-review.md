# 최종 사용자 UI/UX 검수 (#307)

[검수 이슈 #307](https://github.com/K4RF/reservation-platform/issues/307) ·
[기술 검증 인계 #306](frontend-review-handoff.md) · [승인 디자인](../ui/approved-design.md)

**검수 대기 — 최종 판단은 사용자가 직접 남긴다.** 선행 #299–#306은 모두 종료됐다.
제품 기준 revision은 #306 병합 `f4d0c2cd1b7dc9f533ee1a2af381f617555a700a`이며
[선행 Frontend CI](https://github.com/K4RF/reservation-platform/actions/runs/42486125055)와
[Backend CI](https://github.com/K4RF/reservation-platform/actions/runs/42486125069)가 통과했다.
병합된 기준의 [develop Frontend CI](https://github.com/K4RF/reservation-platform/actions/runs/42487934575)도 통과했다.
다른 revision에서 검수하면 `git rev-parse HEAD`의 결과를 기록한다. CI, 개발자 검증,
A1 디자인 방향 승인 중 어느 것도 전체 제품 승인으로 간주하지 않는다.

## 1. 실제 사이트 열기

Java 21, Docker Desktop/Compose, [Frontend의 Node 및 pnpm 버전](../../frontend/README.md)을 준비한다.
아래는 저장소 루트에서 시작하는 PowerShell 7 예시다.
macOS/Linux는 Backend에서 `./gradlew bootJar`를 사용하고,
[격리 실행 안내](frontend-backend-integration.md)에 따라 같은 옵션을 사용한다.

```powershell
git rev-parse HEAD
Push-Location backend
.\gradlew.bat bootJar
Pop-Location
Push-Location frontend
pnpm install --frozen-lockfile
Pop-Location
```

각 작업이 성공한 뒤, 아래 세션 중 **한 번에 하나만** 시작한다. 예시는 예약 생성 검수다.
동일 포트를 사용하므로 다른 세션으로 넘어갈 때는 브라우저 탭을 닫고 이전 터미널에서 Enter를 누른다.
마지막 정리 메시지가 나온 뒤 다음 실행으로 넘어간다.

```powershell
$env:INTEGRATION_FIXTURE_PASSWORD = Read-Host -MaskInput '이번 검수에만 쓸 임시 비밀번호 (12~72바이트)'
try {
    node scripts/integration/run.mjs --booking --hold
} finally {
    Remove-Item Env:INTEGRATION_FIXTURE_PASSWORD -ErrorAction SilentlyContinue
}
```

터미널이 준비를 마치면 브라우저에서 [검수 사이트](http://127.0.0.1:15199/)를 연다.
[Swagger](http://127.0.0.1:18099/swagger-ui.html)는 계약 참고용이다.
실행기는 전용 DB·Redis·Kafka·Media 경로만 사용한다. 기존 개발 Compose와 `.env`는 바꾸지 않는다.
사이트는 루프백 전용이다. Desktop의 반응형 모드에서 390px을 확인할 수 있지만,
다른 기기에서 이 주소로 접속할 수는 없다. 실기기 검수는 승인된 별도 테스트 환경에서만 한다.

로그인 비밀번호는 위 명령에서 **본인이 입력한 값**이다.

| 로그인 이메일 | 용도 |
| --- | --- |
| `fixture-owner@example.test` | 회원 예약 생성 및 본인 예약 검수 |
| `fixture-other@example.test` | 일반 회원, 타인 예약·관리 권한 차단 확인 |
| `fixture-admin@example.test` | 관리 메뉴와 격리 카탈로그·정책·가격·재고·사진 검수 |

가입 화면은 위 계정과 별도의 가상 이메일(예: `review-new@example.test`)과 임시 비밀번호로 확인한다.
가입·로그인 흐름을 확인한 뒤 로그아웃하고, 아래 준비된 날짜와 예약은 fixture-owner 계정으로 확인한다.
실제 Google 버튼은 외부 Provider로 이어지는 경로이므로
이 세션에서 누르지 않는다. 결제·환불은 실행하거나 완료했다고 기록하지 않는다.

## 2. 검수 동선

| 세션 | 사용자가 확인할 순서 |
| --- | --- |
| `--booking --hold` | 익명 Home에서 Hero, 글자/여백·헤더/메뉴를 본다. 검색 카드에서 실제 테스트 Media와 미제공 상태를 비교하고 필터를 조작한다. 터미널의 `Browser #301 fixture`에 출력된 도시·날짜·인원으로 가용성을 읽는다. Detail에서 Gallery·객실 상세·날짜/인원·예약 Rail/모바일 CTA를 확인하고 `Integration Fixture Room`을 선택한다. fixture-owner로 로그인 복귀와 새 가용성 조회를 따라가고, 가상 투숙객 입력→최종 확인→한 번 제출→서버 완료와 내 예약으로 이어지는지 본다. |
| `--management --hold` | fixture-owner로 내 예약에 들어가 `Browser #302 fixture`의 상세 경로를 연다. 저장된 박별 요금·취소 정책과 현재 화면 정보를 구분한다. 출력된 새 날짜로 일정 변경 후 다시 조회하고, 취소 전 정책 확인→명시적 동의→저장 결과를 확인한다. 테스트 변경·취소를 중간에 멈추면 실행기가 예상된 최종 상태와 다르다고 보고할 수 있다. 확인을 통과시키려고 취소하거나 쓰기를 반복하지 말고 아래 정리 절차를 따른다. |
| `--admin --hold` | 익명·일반 회원의 `/admin` 차단과 ADMIN 메뉴 접근을 확인한다. `Browser #303 fixture`의 숙소·객실 ID와 날짜를 사용한다. 숙소·객실 대상 전환, 지원되는 관리 입력, 정책의 마지막 쓰기 결과, DEFAULT/DAILY 가격과 재고 Calendar를 본다. 사진은 가상 JPEG/PNG만 쓰고, 저장 후 관리 목록과 공개 대표 사진을 새로 읽는다. 결과 불명 또는 오래된 ETag는 새 목록 조회·재검토 전 재제출하지 않는다. |

#303의 검수 객실은 운영 중지로 시작하므로 재고는 먼저 조회만 된다. 격리 세션에서
재고 편집까지 확인할 때는 해당 객실만 ACTIVE로 전환한 뒤 Calendar를 다시 조회한다.
출력 범위의 첫날은 DAILY와 CLOSED 재고, 중간 날짜는 DEFAULT와 미생성 재고를 비교할 수 있다.
출력된 숙소에는 이미 정책이 있으므로 수정(PUT)을 선택한다. 정책 생성(POST)은 새로 등록한
테스트 숙소에서 확인한다. 정책 GET이나 전체 예약 관리 메뉴는 이 범위에 없다.

각 화면에서 Desktop과 390px을 비교한다. 모바일 메뉴/필터/날짜·객실 Sheet, 작은 글씨,
고정 버튼의 가림, 어색한 문구나 내부 정보 노출, 작업 흐름의 일관성을 중점적으로 본다.
**사진 실패, Loading/Empty/Error, 긴 텍스트**는 실제 DB를 조작해 강제하지 않고
[읽기 전용 UI Audit](../../frontend/scripts/ui-audit/README.md#화면-비교-재현-305)의 합성 모드로 재현한다.
이 결과는 실제 사이트/실기기 결과와 구분한다.

[1440/390 원본과 제품 비교·키보드 증거](frontend-browser-accessibility.md)를 참고한다.
이전 작업 환경의 `.local/ui-audit-305-review.zip`이 있으면 36장 캡처를 볼 수 있다.
ZIP은 Git에 없으므로 다른 Clone에서는 재현 표로 비교한다.
Booking·내 예약·Auth·Admin은 [재구성 명세](../ui/prototype-rebuild.md)의 구성안과 비교한다.
이 화면들은 독립된 승인 시안의 픽셀 일치 대상이 아니다.

## 3. 결과 기록과 종료

- 실패한 쓰기는 성공 여부가 불명확할 수 있다. 먼저 최신 본인 예약·관리 목록·가격/재고를 읽고,
  이 실행만의 상태를 확인한다. 정리 실패 시 [격리 실행의 실패 복구](frontend-backend-integration.md#실패-시-복구)를
  따른다. 개발 Compose, 기존 Volume, 운영 계정은 정리 대상으로 삼지 않는다.
- #307에 대상 SHA, 브라우저/OS/기기·화면 폭, 재현 단계, 기대와 실제, 검증하지 못한 항목을 남긴다.
  화면을 첨부하더라도 비밀번호·토큰·투숙객 정보를 넣지 않는다.
- 작은 문구·여백·정렬·버튼 문제는 f0.6.0 수정 후보로 기록하고 수정 후 같은 조건으로 재검수한다.
  전체 구조 변경·신규 기능·Backend 확장은 후속 작업으로 분류한다. 실제 발견 내용이 없으면 이슈를 미리 만들지 않는다.
- 사용자 판단은 **최종 승인 / 수정 후 재검수 / 미검증 보류** 중 해당 상태를 명시한다.
  사용자 승인 전까지 #307은 Open 상태다. 이 준비 PR은 병합되더라도 이슈나 마일스톤을 자동 종료하지 않는다.
