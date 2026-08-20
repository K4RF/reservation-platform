# ADR-003: Redis 기반 Refresh Token 상태 관리

## 상태

Accepted

## 결정

- Access Token은 짧은 수명의 JWT로 발급하고 서버에 저장하지 않는다.
- Refresh Token은 Access Token보다 긴 수명의 JWT로 발급한다.
- 두 Token은 `token_type` Claim으로 구분하며 Refresh Token은 API 인증에 사용할
  수 없다.
- Refresh Token은 Redis의 `refresh:{memberId}` Key에 저장하고 JWT 만료시간과
  동일한 TTL을 적용한다.
- 새 로그인은 회원별 기존 Refresh Token을 교체한다.
- 재발급 시 JWT 서명·만료·종류와 Redis 저장값 일치를 모두 검증한다.
- 로그아웃은 Redis Refresh Token을 삭제한다.

## 결과와 한계

서버는 Refresh Token 재사용과 로그아웃 이후 재발급을 통제할 수 있다. 다만
Access Token Blacklist는 적용하지 않으므로 로그아웃 전에 발급된 Access Token은
자체 만료시간까지 유효하다. Redis는 현재 Token 저장에만 사용하며 분산 락과
Cache 도입 여부는 별도 성능·동시성 작업에서 결정한다.
