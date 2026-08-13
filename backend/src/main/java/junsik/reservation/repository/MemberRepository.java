package junsik.reservation.repository;

import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

import junsik.reservation.entity.Member;

public interface MemberRepository extends JpaRepository<Member, Long> {

	boolean existsByEmail(String email);

	Optional<Member> findByEmail(String email);
}
