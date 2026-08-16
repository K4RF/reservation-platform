package junsik.reservation.config;

import org.springframework.context.annotation.Configuration;

import io.swagger.v3.oas.annotations.OpenAPIDefinition;
import io.swagger.v3.oas.annotations.enums.SecuritySchemeType;
import io.swagger.v3.oas.annotations.info.Info;
import io.swagger.v3.oas.annotations.security.SecurityScheme;

@Configuration
@OpenAPIDefinition(
		info = @Info(
				title = "Reservation Platform API",
				description = "예약 충돌 문제를 단계적으로 해결하는 Reservation Platform Backend API",
				version = "v1"
		)
)
@SecurityScheme(
		name = OpenApiConfig.BEARER_AUTH,
		type = SecuritySchemeType.HTTP,
		scheme = "bearer",
		bearerFormat = "JWT",
		description = "로그인 API에서 발급받은 JWT Access Token을 입력합니다."
)
public class OpenApiConfig {

	public static final String BEARER_AUTH = "bearerAuth";
}
