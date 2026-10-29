# ADR-007: Catalog Media 메타데이터와 로컬 파일 읽기 분리

## 상태

Accepted for #272 local development/read baseline, 2026-10-29.
다중 인스턴스 배포 저장소 또는 업로드 수명주기 전체를 확정한 결정은 아니다.

## 배경

승인 시안의 사진 중심 화면에는 실제 소유/출처를 가진 숙소·객실 Media가 필요하다.
기존 DTO/Storage는 없고 로컬 개발에 유료 계정·Secret을 새로 요구하지 않아야 한다.
검색/가용성의 페이징·가격·캐시 경계도 유지해야 한다.

## 결정

- MySQL `catalog_media`에 한 소유자 FK·정렬·alt·픽셀/바이트·출처/권리를 저장한다.
  `(sort_order,id)` 첫 행을 대표로 정의하며 파일 bytes는 BLOB/JSON에 저장하지 않는다.
- 로컬에서는 `MEDIA_STORAGE_ROOT` 아래 immutable UUID 파일을 보관하고,
  공개 `GET /api/v1/media/{id}/content`가 DB/경로/파일 크기를 확인해 읽는다.
  원격 URL 수집·Storage 공급자 abstraction·별도 인프라를 도입하지 않는다.
- 기존 응답에 목록 대표1장/상세 최대20장을 한 번의 page-batched window 쿼리로 붙인다.
  상세 snapshot만 Redis v2 prefix로 캐시하고 검색/가용성/파일 bytes는 우회한다.
- 기존 transaction-aware eviction을 재사용하는 트랜잭션 필수 hook을 #273에 제공한다.
  public URL은 API origin 기준 상대 URL, 초기 HTTP 캐시는 no-store다.

## 대안

- 객체 저장소/CDN: 다중 인스턴스·파생 크기에 유리하지만 계정·권한·비용·배포 결정이 필요해 지금 선택하지 않는다.
- DB BLOB: 파일/DB 원자성은 단순해지지만 현재 catalog/백업/직렬화 경계를 무겁게 하므로 채택하지 않는다.
- 임의 원격 URL: 권리/파일 수명주기 통제와 SSRF/추적 위험이 있어 입력/대리 fetch를 제공하지 않는다.
- 부모 Collection eager JOIN: 목록 중복·페이징·N+1 위험 대신 ID별 bounded 조회를 선택한다.

## 결과·한계

DB와 파일의 공동 영속/백업, 앱 컨테이너 mount, 총 디스크 quota는 운영 책임이다.
로컬 경로는 다중 인스턴스 공유 저장소가 아니며 파일/DB commit 원자성도 없다.
썸네일 변환·장기 캐시가 없어 다운로드 비용은 남는다. 실제 측정 뒤 확장한다.
업로드 decode/권한/제한·파일 정리/실패 복구·모든 Media 쓰기의 eviction 연결은 #273에서 구현한다.
Frontend 연결/시안 재현/사용자 승인은 별도다. [상세 계약/실행 방법](../architecture/catalog-media.md)을 따른다.
