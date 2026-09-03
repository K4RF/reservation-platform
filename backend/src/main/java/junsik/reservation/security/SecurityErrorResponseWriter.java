package junsik.reservation.security;

import java.io.IOException;
import java.nio.charset.StandardCharsets;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;

import junsik.reservation.global.exception.ErrorCode;
import junsik.reservation.global.exception.ErrorResponse;
import tools.jackson.databind.ObjectMapper;

@Component
public class SecurityErrorResponseWriter {

	private final ObjectMapper objectMapper;

	public SecurityErrorResponseWriter(ObjectMapper objectMapper) {
		this.objectMapper = objectMapper;
	}

	public void write(
			HttpServletRequest request,
			HttpServletResponse response,
			ErrorCode errorCode
	) throws IOException {
		response.setStatus(errorCode.getStatus().value());
		response.setCharacterEncoding(StandardCharsets.UTF_8.name());
		response.setContentType(MediaType.APPLICATION_JSON_VALUE);
		objectMapper.writeValue(
				response.getOutputStream(),
				ErrorResponse.of(errorCode, request.getRequestURI())
		);
	}
}
