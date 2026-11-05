# #283 관리자 Browser 비교 캡처

2026-11-05, CSS Viewport `1440×900` / `390×844`. 목록·상세·원본의 기본 Viewport는 `scrollY=0`에서 비교했다.
편집/결과는 작업 버튼 또는 결과로 포커스를 이동한 시점의 Viewport다. 래스터 폭·높이는 Browser 내보내기의 스크롤바/표시 영역에 따라 CSS Viewport보다 작을 수 있다.

| 비교 | 1440 Viewport / 전체 | 390 Viewport / 전체 |
| --- | --- | --- |
| 독립 Search 원본, Studio 제외 | [Viewport](reference-search-1440.jpg) · [#278 전체](../278/reference-1440-full.jpg) | [Viewport](reference-search-390.jpg) · [#278 전체](../278/reference-390-full.jpg) |
| 독립 Detail 원본, Studio 제외 | [Viewport](reference-detail-1440.jpg) · [#279 전체](../279/reference-1440-full.jpg) | [Viewport](reference-detail-390.jpg) · [#279 전체](../279/reference-390-full.jpg) |
| 변경 전 숙소 상세 | [Viewport](before-detail-1440.jpg) · [전체](before-detail-1440-full.jpg) | [Viewport](before-detail-390.jpg) · [전체](before-detail-390-full.jpg) |
| 숙소 목록, 사진 표시 | [Viewport](catalog-1440.jpg) · [전체](catalog-1440-full.jpg) | [Viewport](catalog-390.jpg) · [전체](catalog-390-full.jpg) |
| 숙소 읽기 요약 | [Viewport](detail-1440.jpg) · [전체](detail-1440-full.jpg) | [Viewport](detail-390.jpg) · [전체](detail-390-full.jpg) |
| 숙소 정보 편집 | [Viewport](detail-edit-1440.jpg) · [전체](detail-edit-1440-full.jpg) | [Viewport](detail-edit-390.jpg) · [전체](detail-edit-390-full.jpg) |
| 객실 요약 | [Viewport](room-1440.jpg) · [전체](room-1440-full.jpg) | [Viewport](room-390.jpg) · [전체](room-390-full.jpg) |
| 사진 관리 앨범 | [Viewport](album-1440.jpg) · [전체](album-1440-full.jpg) | [Viewport](album-390.jpg) · [전체](album-390-full.jpg) |
| 사진 없음 / 실패 (전체) | [없음](album-missing-1440-full.jpg) · [실패](album-failed-1440-full.jpg) | [없음](album-missing-390-full.jpg) · [실패](album-failed-390-full.jpg) |
| 정책 직전 성공 응답 | [Viewport](policy-success-1440.jpg) · [전체](policy-success-1440-full.jpg) | [Viewport](policy-success-390.jpg) · [전체](policy-success-390-full.jpg) |
| 정책 결과 불명·잠금 | [Viewport](policy-error-1440.jpg) · [전체](policy-error-1440-full.jpg) | [Viewport](policy-error-390.jpg) · [전체](policy-error-390-full.jpg) |
| 날짜별 가격 조회 | [Viewport](price-1440.jpg) · [전체](price-1440-full.jpg) | [Viewport](price-390.jpg) · [전체](price-390-full.jpg) |
| 날짜별 가격 편집 | [Viewport](price-edit-1440.jpg) · [전체](price-edit-1440-full.jpg) | [Viewport](price-edit-390.jpg) · [전체](price-edit-390-full.jpg) |
| 긴 재고 조회 | [Viewport](inventory-1440.jpg) · [전체](inventory-1440-full.jpg) | [Viewport](inventory-390.jpg) · [전체](inventory-390-full.jpg) |
| 긴 재고의 선택 날짜 편집 | [Viewport](inventory-edit-1440.jpg) · [전체](inventory-edit-1440-full.jpg) | [Viewport](inventory-edit-390.jpg) · [전체](inventory-edit-390-full.jpg) |

- 390px [사진 삭제 준비](album-delete-preparation-390-full.jpg)는 선택까지만 수행했고 Browser에서 삭제를 제출하지 않았다.
  사진은 [AI 가상 콘셉트](../../prototypes/premium-travel/ASSETS.md)이며 실매물에 연결되지 않는다.
- 390px [숙소 생성](accommodation-create-390-full.jpg) · [객실 생성](room-create-390-full.jpg) ·
  목록 [조회 대기](catalog-loading-390.jpg) · [오류](catalog-read-error-390.jpg) · [빈 상태](catalog-empty-390.jpg).
- [390px 표 포커스](inventory-table-focus-390.jpg)와 [320px·글자 200%](inventory-table-320-text200.jpg)는 문서가 아닌 표 내부 가로 이동을 확인한 캡처다.
- [Audit 재현](../../../../frontend/scripts/ui-audit/README.md): `role=ADMIN`, `path=/admin/...`, `media=present|missing|failed`.
  정책은 `admin=policy-success|policy-error`에서 예약 정책 생성만 합성하고, 재고는 `scenario=stress` 및 `roomId=3&startDate=2030-07-20&endDate=2030-08-20`.
  실제 백엔드로 전송하거나 저장하지 않는다. 320px 확대는 `textScale=200`으로 OS/Browser 확대와 같지 않다.

[구현과 검증 기록](../../frontend-admin-workspace-283.md)
