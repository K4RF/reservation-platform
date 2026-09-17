# Cache Invalidation 및 데이터 정합성 정책

## 범위

현재 Redis Cache 대상은 `AccommodationResponse`와 `RoomResponse` 단건 두 종류다.
이 문서는 각 DTO 필드의 원본과 모든 애플리케이션 Command를 비교해 어떤 변경이
Cache 무효화를 요구하는지 정의한다. 검색 목록, 재고, 가격 조회, 정책, 예약은 Cache
대상이 아니므로 존재하지 않는 Cache를 선제적으로 지우지 않는다.

## Cache Value 의존성

### 숙소 상세

`AccommodationResponse`는 다음 숙소 데이터만 포함한다.

- 이름, 설명
- 국가, 도시, 지역, 상세 주소
- 숙소 편의시설
- 체크인·체크아웃 시간과 TimeZone
- 운영 상태

객실, Booking Policy, Cancellation Policy, 재고, 가격, 예약 정보는 포함하지 않는다.

### 객실 상세

`RoomResponse`는 다음 객실 데이터만 포함한다.

- 객실 ID와 숙소 ID
- 이름, 수용 인원, 기본 1박 가격
- 객실 편의시설
- 운영 상태

숙소의 이름·상태·위치, 날짜별 가격, 재고, 예약 정보는 포함하지 않는다.

## Command별 무효화 Matrix

| Command | 변경 데이터 | 숙소 상세 | 객실 상세 | 정책 |
| --- | --- | --- | --- | --- |
| 숙소 생성 | 신규 숙소 전체 | 없음 | 없음 | 기존 ID Cache가 없으므로 처리 없음 |
| 숙소 정보 수정 | 위치·편의시설·운영시간 포함 숙소 상세 | 해당 숙소 ID Evict | 없음 | Commit 후 Evict |
| 숙소 상태 변경 | 숙소 운영 상태 | 해당 숙소 ID Evict | 없음 | 객실 DTO에는 숙소 상태가 없어 연쇄 Evict하지 않음 |
| 객실 생성 | 신규 객실 전체 | 없음 | 없음 | 목록 Cache가 없으므로 처리 없음 |
| 객실 정보 수정 | 편의시설·기본 가격 포함 객실 상세 | 없음 | 해당 객실 ID Evict | Commit 후 Evict |
| 객실 상태 변경 | 객실 운영 상태 | 없음 | 해당 객실 ID Evict | Commit 후 Evict |
| 날짜별 가격 등록·수정 | 특정 객실·날짜 가격 | 없음 | 없음 | RoomResponse는 날짜별 가격을 포함하지 않음 |
| Booking Policy 등록·수정 | 예약 가능 기간 정책 | 없음 | 없음 | AccommodationResponse에 정책이 없음 |
| Cancellation Policy 등록·수정 | 취소 기한·수수료 정책 | 없음 | 없음 | AccommodationResponse에 정책이 없음 |
| 재고 등록·수정·예약·반환 | 날짜별 수량·판매 상태 | 없음 | 없음 | 상세 DTO에 재고가 없음 |
| 예약 생성·일정 변경·취소 | 예약·재고·Snapshot | 없음 | 없음 | 두 상세 DTO에 예약 상태가 없음 |

Amenity는 독립 수정 API가 없고 숙소 또는 객실 정보 수정 Command 안에서 교체된다.
따라서 각각의 상세 ID Evict가 편의시설 정합성도 함께 보장한다. 객실 기본 가격은
Room 정보 수정에 포함되므로 Room 상세 Cache를 지우지만, 날짜별 가격은 Room 상세
Response에 포함되지 않아 지우지 않는다.

## Evict, Update, TTL 선택

애플리케이션 Command에는 Cache Update가 아니라 ID 단위 Evict를 사용한다.

- Response를 다시 구성해 쓰는 Cache Update보다 다음 조회의 Cache Aside 재적재가
  단순하며 단일 원본인 Database를 유지한다.
- 전체 Cache 삭제 대신 변경된 Entity ID 하나만 제거해 다른 상세 Hit를 보존한다.
- 한 Transaction에서 숙소와 객실 Command를 함께 실행하면 두 Evict가 각각 등록되고
  Commit 이후 두 Key가 모두 제거된다.
- 모든 애플리케이션 변경 경로는 명시적 Evict 대상이거나 DTO와 무관함이 확인됐으므로
  TTL만으로 정합성을 유지하는 내부 Command는 없다.

10분 TTL은 외부 SQL처럼 애플리케이션 Evict를 거치지 않는 변경이나 Redis Evict 실패의
Stale 상한을 제공한다. 외부 Writer를 정상 변경 경로로 허용하는 정책은 아니며, 그런
Writer가 추가되면 동일 Key 무효화 계약 또는 별도 Event/Version 전략이 필요하다.

## Transaction 순서

`@CacheEvict(beforeInvocation = false)`와 Transaction-aware `RedisCacheManager`를 함께
사용한다.

```text
Command 호출
  → Database Entity 변경
  → Service 정상 반환: Evict 요청 등록
  → Database Commit
  → Redis Key Evict 실행
```

- Service가 예외로 종료되면 `beforeInvocation=false`이므로 Evict 요청 자체가 없다.
- 더 큰 외부 Transaction에 참여한 Service가 정상 반환해도 Commit 전에는 기존 Key를
  유지한다.
- 외부 Transaction이 rollback되면 예약된 Evict를 실행하지 않아 Database의 이전 값과
  Cache의 이전 값이 일치한다.
- Commit되면 해당 Key를 제거하고 다음 조회가 Commit된 Database 값으로 재적재한다.

Database와 Redis는 하나의 분산 Transaction에 참여하지 않는다. 따라서 Database
Commit 직후 Redis Evict 전의 매우 짧은 구간과 Commit 뒤 Redis 장애로 Evict가 실패하는
경우를 원자적으로 제거할 수는 없다. 현재는 짧은 TTL로 Stale 상한을 두며, 엄격한
보장이 필요해지면 Transactional Outbox 기반 무효화 재시도나 Versioned Cache Key를
별도로 검토한다.

## 검증

`RedisCacheInvalidationIntegrationTest`는 H2와 격리된 Redis 7.4 Testcontainer에서
다음을 검증한다.

1. 숙소·객실 Key를 먼저 Cache한다.
2. 하나의 외부 Transaction에서 두 상태 변경을 수행한다.
3. Transaction 내부에는 두 Key가 남아 있음을 확인한다.
4. Commit 후에는 두 Key가 제거되고 다음 조회가 최신 상태를 반환하는지 확인한다.
5. 같은 변경 뒤 강제로 rollback하면 두 Key와 Database 값이 모두 이전 상태인지
   확인한다.

기존 `RedisDetailCacheIntegrationTest`는 정보·Amenity·기본 가격 및 상태 변경 후
Stale Value가 반환되지 않는지, TTL 만료 후 Database를 다시 조회하는지 검증한다.
