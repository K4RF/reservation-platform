package junsik.reservation.global.exception;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Positive;

class GlobalExceptionHandlerTest {

	private MockMvc mockMvc;

	@BeforeEach
	void setUp() {
		mockMvc = MockMvcBuilders
				.standaloneSetup(new TestController())
				.setControllerAdvice(new GlobalExceptionHandler())
				.build();
	}

	@Test
	void handlesBusinessExceptionWithErrorCodeStatus() throws Exception {
		mockMvc.perform(get("/test/business-error"))
				.andExpect(status().isConflict())
				.andExpect(jsonPath("$.timestamp").isNotEmpty())
				.andExpect(jsonPath("$.status").value(409))
				.andExpect(jsonPath("$.code").value("TEST_001"))
				.andExpect(jsonPath("$.message").value("테스트 비즈니스 규칙을 위반했습니다."))
				.andExpect(jsonPath("$.path").value("/test/business-error"))
				.andExpect(jsonPath("$.errors").isEmpty());
	}

	@Test
	void handlesBeanValidationExceptionWithFieldErrors() throws Exception {
		mockMvc.perform(post("/test/validation")
					.contentType(MediaType.APPLICATION_JSON)
					.content("{\"name\":\"\"}"))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.status").value(400))
				.andExpect(jsonPath("$.code").value("COMMON_001"))
				.andExpect(jsonPath("$.message").value("입력값이 올바르지 않습니다."))
				.andExpect(jsonPath("$.path").value("/test/validation"))
				.andExpect(jsonPath("$.errors[0].field").value("name"))
				.andExpect(jsonPath("$.errors[0].message").value("이름은 필수입니다."));
	}

	@Test
	void handlesMalformedJsonAsInvalidRequest() throws Exception {
		mockMvc.perform(post("/test/validation")
					.contentType(MediaType.APPLICATION_JSON)
					.content("{\"name\":"))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.code").value("COMMON_002"))
				.andExpect(jsonPath("$.path").value("/test/validation"))
				.andExpect(jsonPath("$.errors").isEmpty());
	}

	@Test
	void handlesPathVariableTypeMismatchAsInvalidRequest() throws Exception {
		mockMvc.perform(get("/test/numbers/not-a-number"))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.code").value("COMMON_002"))
				.andExpect(jsonPath("$.path").value("/test/numbers/not-a-number"));
	}

	@Test
	void handlesMissingRequestParameterAsInvalidRequest() throws Exception {
		mockMvc.perform(get("/test/query"))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.code").value("COMMON_002"))
				.andExpect(jsonPath("$.path").value("/test/query"));
	}

	@Test
	void handlesMethodParameterValidationException() throws Exception {
		mockMvc.perform(get("/test/query").param("page", "0"))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.code").value("COMMON_001"))
				.andExpect(jsonPath("$.path").value("/test/query"));
	}

	@Test
	void hidesUnexpectedExceptionDetails() throws Exception {
		mockMvc.perform(get("/test/unexpected-error"))
				.andExpect(status().isInternalServerError())
				.andExpect(jsonPath("$.status").value(500))
				.andExpect(jsonPath("$.code").value("COMMON_003"))
				.andExpect(jsonPath("$.message").value("서버 내부 오류가 발생했습니다."))
				.andExpect(jsonPath("$.message").value(org.hamcrest.Matchers.not("sensitive detail")))
				.andExpect(jsonPath("$.path").value("/test/unexpected-error"));
	}

	@RestController
	@RequestMapping("/test")
	private static class TestController {

		@GetMapping("/business-error")
		void businessError() {
			throw new BusinessException(TestErrorCode.CONFLICT);
		}

		@PostMapping("/validation")
		void validation(@Valid @RequestBody TestRequest request) {
		}

		@GetMapping("/numbers/{number}")
		void number(@PathVariable int number) {
		}

		@GetMapping("/query")
		void query(@RequestParam @Positive int page) {
		}

		@GetMapping("/unexpected-error")
		void unexpectedError() {
			throw new IllegalStateException("sensitive detail");
		}
	}

	private record TestRequest(@NotBlank(message = "이름은 필수입니다.") String name) {
	}

	private enum TestErrorCode implements ErrorCode {
		CONFLICT(HttpStatus.CONFLICT, "TEST_001", "테스트 비즈니스 규칙을 위반했습니다.");

		private final HttpStatus status;
		private final String code;
		private final String message;

		TestErrorCode(HttpStatus status, String code, String message) {
			this.status = status;
			this.code = code;
			this.message = message;
		}

		@Override
		public HttpStatus getStatus() {
			return status;
		}

		@Override
		public String getCode() {
			return code;
		}

		@Override
		public String getMessage() {
			return message;
		}
	}
}
