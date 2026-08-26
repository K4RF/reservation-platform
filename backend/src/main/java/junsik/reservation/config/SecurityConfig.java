package junsik.reservation.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.ProviderManager;
import org.springframework.security.authentication.dao.DaoAuthenticationProvider;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;

import junsik.reservation.security.JwtAccessDeniedHandler;
import junsik.reservation.security.JwtAuthenticationEntryPoint;
import junsik.reservation.security.JwtAuthenticationFilter;
import junsik.reservation.security.OAuth2AuthenticationFailureHandler;
import junsik.reservation.security.OAuth2AuthenticationSuccessHandler;
import junsik.reservation.service.OAuth2MemberService;

@Configuration
public class SecurityConfig {

	@Bean
	AuthenticationManager authenticationManager(
			UserDetailsService userDetailsService,
			PasswordEncoder passwordEncoder
	) {
		DaoAuthenticationProvider provider = new DaoAuthenticationProvider(userDetailsService);
		provider.setPasswordEncoder(passwordEncoder);
		return new ProviderManager(provider);
	}

	@Bean
	SecurityFilterChain securityFilterChain(
			HttpSecurity http,
			JwtAuthenticationFilter jwtAuthenticationFilter,
			JwtAuthenticationEntryPoint authenticationEntryPoint,
			JwtAccessDeniedHandler accessDeniedHandler,
			OAuth2MemberService oauth2MemberService,
			OAuth2AuthenticationSuccessHandler oauth2SuccessHandler,
			OAuth2AuthenticationFailureHandler oauth2FailureHandler
	) throws Exception {
		http
				.csrf(AbstractHttpConfigurer::disable)
				.formLogin(AbstractHttpConfigurer::disable)
				.httpBasic(AbstractHttpConfigurer::disable)
				.sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
				.exceptionHandling(exceptions -> exceptions
						.authenticationEntryPoint(authenticationEntryPoint)
						.accessDeniedHandler(accessDeniedHandler))
				.oauth2Login(oauth2 -> oauth2
						.userInfoEndpoint(userInfo -> userInfo.userService(oauth2MemberService))
						.successHandler(oauth2SuccessHandler)
						.failureHandler(oauth2FailureHandler))
				.authorizeHttpRequests(authorize -> authorize
						.requestMatchers("/v3/api-docs/**", "/swagger-ui/**", "/swagger-ui.html").permitAll()
						.requestMatchers(HttpMethod.POST, "/api/v1/members").permitAll()
						.requestMatchers(HttpMethod.POST, "/api/v1/auth/login").permitAll()
						.requestMatchers(HttpMethod.POST, "/api/v1/auth/reissue").permitAll()
						.requestMatchers(HttpMethod.POST, "/api/v1/accommodations").hasRole("ADMIN")
						.requestMatchers(HttpMethod.POST, "/api/v1/accommodations/*/rooms").hasRole("ADMIN")
						.requestMatchers(HttpMethod.PUT, "/api/v1/accommodations/*", "/api/v1/rooms/*")
						.hasRole("ADMIN")
						.requestMatchers(
								HttpMethod.PATCH,
								"/api/v1/accommodations/*/status",
								"/api/v1/rooms/*/status"
						).hasRole("ADMIN")
						.requestMatchers("/oauth2/**", "/login/oauth2/**").permitAll()
						.requestMatchers("/error").permitAll()
						.requestMatchers("/api/v1/admin/**").hasRole("ADMIN")
						.anyRequest().authenticated())
				.addFilterBefore(jwtAuthenticationFilter, UsernamePasswordAuthenticationFilter.class);

		return http.build();
	}
}
