# Architecture Decision Records

프로젝트의 주요 기술적 의사결정을 ADR 형식으로 기록합니다.

ADR 문서 예시:

- ADR-001: 모듈러 모놀리스 채택
- ADR-002: 데이터베이스 동시성 제어 방식 선택
- ADR-003: Redis 분산 락 도입
- ADR-005: Kafka 이벤트 처리 방식 선택

현재 ADR:

- [ADR-003: Redis 기반 Refresh Token 상태 관리](003-redis-refresh-token.md)
- [ADR-004: 예약 가격 Snapshot을 첫 숙박일 가격과 총액으로 저장](004-reservation-price-snapshot.md)
- [ADR-005: 취소 정책을 예약 생성 시 값으로 복제해 Snapshot 저장](005-cancellation-policy-snapshot.md)

각 ADR은 다음 항목을 포함합니다.

- Context
- Decision
- Alternatives
- Consequences
