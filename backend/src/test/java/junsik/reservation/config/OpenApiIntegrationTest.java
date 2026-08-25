package junsik.reservation.config;

import static org.hamcrest.Matchers.containsInAnyOrder;
import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.endsWith;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.test.web.servlet.MockMvc;

@SpringBootTest
@AutoConfigureMockMvc
class OpenApiIntegrationTest {

	@Autowired
	private MockMvc mockMvc;

	@Test
	void exposesSwaggerUiWithoutAuthentication() throws Exception {
		mockMvc.perform(get("/swagger-ui.html"))
				.andExpect(status().is3xxRedirection())
				.andExpect(header().string("Location", "/swagger-ui/index.html"));

		mockMvc.perform(get("/swagger-ui/index.html"))
				.andExpect(status().isOk())
				.andExpect(content().string(containsString("Swagger UI")));
	}

	@Test
	void generatesOpenApiDocumentWithJwtSecurityAndValidationSchemas() throws Exception {
		mockMvc.perform(get("/v3/api-docs"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.openapi").exists())
				.andExpect(jsonPath("$.info.title").value("Reservation Platform API"))
				.andExpect(jsonPath("$.info.description").exists())
				.andExpect(jsonPath("$.info.version").value("v1"))
				.andExpect(jsonPath("$.components.securitySchemes.bearerAuth.type").value("http"))
				.andExpect(jsonPath("$.components.securitySchemes.bearerAuth.scheme").value("bearer"))
				.andExpect(jsonPath("$.components.securitySchemes.bearerAuth.bearerFormat").value("JWT"))
				.andExpect(jsonPath("$.paths['/api/v1/members'].post.security").doesNotExist())
				.andExpect(jsonPath("$.paths['/api/v1/reservations'].post.security[0].bearerAuth").isArray())
				.andExpect(jsonPath(
						"$.paths['/api/v1/accommodations'].get.parameters[*].name",
						containsInAnyOrder("name", "page", "size", "sortBy", "direction")
				))
				.andExpect(jsonPath(
						"$.paths['/api/v1/accommodations/{accommodationId}/rooms'].get.parameters[*].name",
						containsInAnyOrder(
								"accommodationId",
								"minCapacity",
								"minPrice",
								"maxPrice",
								"status",
								"page",
								"size",
								"sortBy",
								"direction"
						)
				))
				.andExpect(jsonPath(
						"$.paths['/api/v1/accommodations/{accommodationId}/rooms/available'].get.security[0].bearerAuth"
				).isArray())
				.andExpect(jsonPath(
						"$.paths['/api/v1/accommodations/{accommodationId}/rooms/available'].get.parameters[*].name",
						containsInAnyOrder(
								"accommodationId",
								"checkInDate",
								"checkOutDate",
								"guestCount",
								"page",
								"size"
						)
				))
				.andExpect(jsonPath(
						"$.paths['/api/v1/reservations'].post.requestBody.content['application/json'].schema['$ref']"
				).value(endsWith("/CreateReservationRequest")))
				.andExpect(jsonPath(
						"$.paths['/api/v1/reservations'].post.responses['201'].content['application/json'].schema['$ref']"
				).value(endsWith("/ReservationResponse")))
				.andExpect(jsonPath("$.components.schemas.SignUpRequest.required", containsInAnyOrder(
						"email",
						"password"
				)))
				.andExpect(jsonPath("$.components.schemas.SignUpRequest.properties.email.format").value("email"))
				.andExpect(jsonPath("$.components.schemas.SignUpRequest.properties.email.maxLength").value(255))
				.andExpect(jsonPath("$.components.schemas.SignUpRequest.properties.password.minLength").value(8))
				.andExpect(jsonPath("$.components.schemas.SignUpRequest.properties.password.maxLength").value(72))
				.andExpect(jsonPath("$.components.schemas.CreateRoomRequest.required", containsInAnyOrder(
						"name",
						"capacity",
						"nightlyPrice"
				)))
				.andExpect(jsonPath("$.components.schemas.RoomResponse.properties.nightlyPrice").exists())
				.andExpect(jsonPath("$.components.schemas.ReservationResponse").exists());
	}
}
