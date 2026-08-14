package junsik.reservation.repository;

import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

import junsik.reservation.entity.SocialAccount;
import junsik.reservation.enums.OAuthProvider;

public interface SocialAccountRepository extends JpaRepository<SocialAccount, Long> {

	Optional<SocialAccount> findByProviderAndProviderUserId(OAuthProvider provider, String providerUserId);
}
