# ADR-008: Media 파일 작업에 durable intent와 소유자 잠금 사용

## 상태

Accepted for #273, 2026-10-29. [ADR-007](007-catalog-media-local-storage.md)의 로컬 저장소 선택을 확장한다.

## 배경

파일시스템과 MySQL은 같은 트랜잭션이 아니다. 단순 catch 삭제는 프로세스 중단 때 파일을 잃어버리고,
commit 전에 옛 파일을 삭제하면 DB rollback이 참조를 복구해도 실제 파일은 복구되지 않는다.
빈 album 동시 업로드·대표/정렬 변경·20장 제한도 하나의 순서로 처리해야 한다.

## 결정

- 업로드 검증 후, 파일 생성 전에 별도 트랜잭션으로 `media_file_cleanup` intent를 commit한다.
  owner 쓰기 트랜잭션은 owner row→intent PK를 잠근 뒤 파일/Media를 저장하고, 성공 commit에서 intent를 제거한다.
  별도 reservation은 owner 트랜잭션 시작 전에 수행해 같은 owner의 대기 요청이 커넥션을 점유한 채
  중첩 REQUIRES_NEW 커넥션을 요구하는 상황을 피한다.
- 교체/삭제는 Media 제거와 옛 key 정리 intent를 같은 DB 트랜잭션에 저장한다. 물리 삭제는 commit 후다.
- 요청 실패 보정/주기적 cleaner는 intent PK 잠금과 현재 DB 참조 확인 후 파일을 지운다.
  만기 secondary index를 잠근 뒤 PK를 잠그는 방식은 실제 MySQL deadlock이 확인돼 사용하지 않는다.
  후보 비잠금 조회→PK 안정 순서 잠금, READ_COMMITTED의 최신 참조 확인을 사용한다.
- ADMIN GET ETag/content fingerprint와 모든 쓰기의 If-Match로 stale 제출을409 거부한다.
  owner 잠금은 빈 목록에도 유효하다. 예약·재고의 기존 동시성 전략은 변경하지 않는다.
- 새로운 외부 Queue/Storage 제공자 대신 작은 DB intent와 기존 스케줄링/캐시 eviction 경계를 사용한다.

## 대안

- 실패 catch에서 파일만 삭제: crash gap과 보정 삭제 실패가 복구 불가능하므로 보조 수단으로만 사용한다.
- 옛 파일 선삭제: rollback 후 읽기가 깨지므로 거부한다.
- 모든 디스크 파일 자동 scan: 다른 writer/기존 수동 파일 오삭제 위험 때문에 제공하지 않는다.
- 분산 트랜잭션/객체 저장소/별도 workflow 엔진: 현재 단일 디스크 단계에 비해 범위가 크므로 도입하지 않는다.

## 결과·한계

물리 삭제는 eventual이고 실패는 DB 기록을 통해 재시도한다. 재시작 후 API가 만든 미귀속/부분 파일도 추적 가능하다.
DB/파일의 원자성·영속 요청 멱등성/ABA history·Redis eviction과 DB의 원자성까지 제공한 것은 아니다.
DB와 root를 함께 백업하고 공유 DB 인스턴스들은 같은 디스크를 사용해야 한다.
수동/외부 도구의 intent 없는 파일은 자동 삭제 대상이 아니다.
[API·운영·복구 계약](../architecture/media-management.md)과 [실제 검증](../testing/media-management-273.md)을 따른다.
