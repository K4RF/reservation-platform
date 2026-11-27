package junsik.reservation.config;

import java.util.List;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;

import io.micrometer.core.instrument.config.MeterFilter;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.annotation.Order;
import org.springframework.core.env.Environment;
import org.springframework.http.HttpMethod;
import org.springframework.security.authentication.ProviderManager;
import org.springframework.security.authentication.dao.DaoAuthenticationProvider;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.core.userdetails.User;
import org.springframework.security.crypto.factory.PasswordEncoderFactories;
import org.springframework.security.provisioning.InMemoryUserDetailsManager;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.servlet.util.matcher.PathPatternRequestMatcher;
import org.springframework.security.web.util.matcher.OrRequestMatcher;
import org.springframework.security.web.util.matcher.RequestMatcher;

@Configuration(proxyBeanMethods = false)
class ObservabilityConfig {

	static final String SCRAPER = "reservation-scraper";
	private static final String SCRAPE_ROLE = "OBSERVABILITY_SCRAPER";
	private static final String ACTUATOR = "/actuator";

	@Bean
	@Order(1)
	SecurityFilterChain managementSecurity(HttpSecurity http, Environment env) throws Exception {
		boolean enabled = env.getProperty("reservation.observability.enabled", Boolean.class, false);
		int configuredPort = env.getProperty("management.server.port", Integer.class, -1);
		int apiPort = env.getProperty("server.port", Integer.class, 8080);
		if ((!enabled && configuredPort != -1) || (enabled &&
				(configuredPort < 0 || (configuredPort != 0 && configuredPort == apiPort)))) {
			throw new IllegalStateException("Observability requires an explicitly enabled, separate management listener");
		}
		if (!ACTUATOR.equals(env.getProperty("management.endpoints.web.base-path", ACTUATOR))
				|| !env.getProperty("management.server.base-path", "").isEmpty()) {
			throw new IllegalStateException("The management path is fixed to /actuator");
		}
		RequestMatcher onManagement = request -> {
			int port = env.getProperty("local.management.port", Integer.class, configuredPort);
			return enabled && port > 0 && request.getLocalPort() == port;
		};
		var paths = PathPatternRequestMatcher.withDefaults();
		http.securityMatcher(new OrRequestMatcher(onManagement, paths.matcher(ACTUATOR), paths.matcher(ACTUATOR + "/**")))
				.formLogin(AbstractHttpConfigurer::disable)
				.logout(AbstractHttpConfigurer::disable)
				.sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS));
		if (enabled) {
			String password = scrapePassword(env);
			if (!password.matches("[A-Za-z0-9_-]{32,128}")) {
				throw new IllegalStateException("A dedicated randomly generated base64url scrape password is required");
			}
			var encoder = PasswordEncoderFactories.createDelegatingPasswordEncoder();
			var scraper = User.withUsername(SCRAPER).password(encoder.encode(password)).roles(SCRAPE_ROLE).build();
			var provider = new DaoAuthenticationProvider(new InMemoryUserDetailsManager(scraper));
			provider.setPasswordEncoder(encoder);
			http.authenticationManager(new ProviderManager(provider))
					.httpBasic(Customizer.withDefaults());
		}
		// Both the listener and an exact GET are required; API Bearer tokens do not enter this chain.
		List<RequestMatcher> readable = List.of("/health", "/health/liveness", "/health/readiness", "/prometheus")
				.stream().<RequestMatcher>map(path -> paths.matcher(HttpMethod.GET, ACTUATOR + path)).toList();
		http.authorizeHttpRequests(auth -> auth
				.requestMatchers(request -> onManagement.matches(request) && readable.stream().anyMatch(m -> m.matches(request)))
				.hasRole(SCRAPE_ROLE)
				.anyRequest().denyAll());
		return http.build();
	}

	private String scrapePassword(Environment env) {
		String inline = env.getProperty("reservation.observability.scrape-password", "");
		String file = env.getProperty("reservation.observability.scrape-password-file", "");
		if (file.isEmpty()) {
			return inline;
		}
		if (!inline.isEmpty()) {
			throw new IllegalStateException("Specify just one scrape credential source");
		}
		try {
			return Files.readString(Path.of(file)).strip();
		} catch (IOException exception) {
			throw new IllegalStateException("Cannot read the dedicated scrape credential");
		}
	}

	@Bean
	MeterFilter foundationMeters() {
		// Keep the export opt-in and narrow. Additional families need a reviewed label budget.
		var families = List.of("jvm.", "process.", "system.", "application.", "hikaricp.", "jdbc.connections.");
		return MeterFilter.denyUnless(id -> "http.server.requests".equals(id.getName())
				|| families.stream().anyMatch(id.getName()::startsWith));
	}

	@Bean
	MeterFilter boundedHttpRoutes() {
		return MeterFilter.maximumAllowableTags("http.server.requests", "uri", 64, MeterFilter.deny());
	}
}
