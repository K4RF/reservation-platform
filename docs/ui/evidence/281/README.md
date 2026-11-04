# #281 Browser 증거

변경 전 2026-11-04, 최종 검증 2026-11-05. 기준 `develop ab93a20` + #281 작업 트리.
모든 데이터·인증은 격리 UI Audit Fixture다. 사진은 [AI 가상 콘셉트](../../prototypes/premium-travel/ASSETS.md)이며 실제 시설 근거가 아니다.
개발 DB/Volume/실계정·예약을 조작하지 않았다. UI Audit의 변경·취소 쓰기는405로 차단된다.

CSS Viewport1440×900 /390×844. 대부분 JPG export1425×891 /375×812이며 full-page는 문서 전체 높이다.
같은 원점(scrollY0)의 Viewport와 full-page를 구분한다. Focus 파일은 확인/오류/행동으로 이동한 위치다.
실제 Zoom/실기기 키보드와 root 글자 확대/짧은 높이는 다르다. 캡처 이미지를 인위적으로 편집/리사이즈하지 않았다.

| 상태 | 1440 | 390 |
| --- | --- | --- |
| 변경 전 목록 | [Viewport](before-list-1440.jpg) · [전체](before-list-1440-full.jpg) | 신규 변경 전 캡처 없음 |
| 변경 전 상세 | [Viewport](before-detail-1440.jpg) · [전체](before-detail-1440-full.jpg) | [Viewport](before-detail-390.jpg) · [전체](before-detail-390-full.jpg) |
| 여행 목록 | [Viewport](list-1440.jpg) · [전체](list-1440-full.jpg) | [Viewport](list-390.jpg) · [전체](list-390-full.jpg) |
| 저장 상세 | [Viewport](detail-1440.jpg) · [전체](detail-1440-full.jpg) | [Viewport](detail-390.jpg) · [전체](detail-390-full.jpg) |
| 일정 변경 검토 | [원점](change-1440.jpg) · [Focus](change-focus-1440.jpg) · [전체](change-1440-full.jpg) | [원점](change-390.jpg) · [Focus](change-focus-390.jpg) · [전체](change-390-full.jpg) |
| 취소 확인 | [원점](cancel-1440.jpg) · [Focus](cancel-focus-1440.jpg) · [전체](cancel-1440-full.jpg) | [원점](cancel-390.jpg) · [Focus](cancel-focus-390.jpg) · [전체](cancel-390-full.jpg) |
| 취소 차단405/잠금 | [원점](cancel-blocked-1440.jpg) · [전체](cancel-blocked-1440-full.jpg) | [오류 Focus](cancel-blocked-390.jpg) · [전체](cancel-blocked-390-full.jpg) |
| 저장 취소 결과 GET | [Viewport](cancelled-1440.jpg) · [전체](cancelled-1440-full.jpg) | [Viewport](cancelled-390.jpg) · [전체](cancelled-390-full.jpg) |
| 목록 사진 미제공 | [1440](list-media-missing-1440.jpg) | [390](list-media-missing-390.jpg) |
| 목록 사진404 | [1440](list-media-failed-1440.jpg) | [390](list-media-failed-390.jpg) |
| 상세 사진 미제공 | [1440](detail-media-missing-1440.jpg) | [390](detail-media-missing-390.jpg) |
| 상세 사진404 | [1440](detail-media-failed-1440.jpg) | [390](detail-media-failed-390.jpg) |
| owner 조회 오류 | [1440](owner-error-1440.jpg) | [390](owner-error-390.jpg) |

보조: [Sticky top24](sticky-1440.jpg), [빈 목록](empty-390.jpg), [로딩](loading-390.jpg),
[320/200% 긴 문자열 Focus](enlarged-stress-320.jpg), [같은 조건 행동 Focus](enlarged-action-320.jpg),
[390×400 짧은 높이](short-height-390.jpg).

## 재현과 한계

`frontend`에서 `node scripts/ui-audit/server.mjs` 실행. `http://127.0.0.1:5174/`의
`?path=%2Freservations&role=USER&media=present`로 목록을 열고42번 상세로 이동한다.
직접 상세는 `path=%2Freservations%2F42`다. `media=missing|failed`는 없음/사진404를 재현한다.

일정 변경 준비 → 달력1/2–1/4 선택/적용 → 가용성 조회 → 내용 확인.
검토는 기존1/1–1/3과 요청1/2–1/4를 비교하며 실제 PATCH를 보내지 않는다.
취소 확인을 열면 fresh owner GET 후 저장 정책/사전 금액 미제공을 표시한다.
동의 후 취소 버튼은 이 Audit에서405로 차단된다. 실제 취소나 네트워크 실패를 재현한 것이 아니다.
`scenario=cancelled`의 저장 취소 결과는 별도 고정 GET Fixture이며 직전 쓰기의 결과로 주장하지 않는다.

`scenario=error|empty|loading`은 각각 조회 오류/빈 목록/초기 로딩이다. loading은 약10초 Timeout 전의 초기 캡처다.
`scenario=stress&textScale=200` 및320×568은 긴 이름/이메일·큰 금액과 root 글자 확대 점검이다.
원본은 Browser의 Detail/보드에서 확인했으나 내 예약 독립 승인 원본은 없다.
원본 캡처와 과거 UI는 [명세](../../prototype-rebuild.md), 실제 차이·요청/CI/HTTP 경계는 [#281 보고서](../../frontend-reservation-rebuild-281.md)를 따른다.
