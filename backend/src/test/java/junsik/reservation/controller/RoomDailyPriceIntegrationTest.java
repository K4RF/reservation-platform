package junsik.reservation.controller;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;
import static junsik.reservation.support.AccommodationFixture.accommodation;
import static junsik.reservation.support.AuthenticationTestSupport.bearerToken;
import static junsik.reservation.support.RoomDailyPriceFixture.DEFAULT_STAY_DATE;
import static junsik.reservation.support.RoomFixture.room;

import java.math.BigDecimal;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import junsik.reservation.entity.Accommodation;
import junsik.reservation.entity.Room;
import junsik.reservation.entity.RoomDailyPrice;
import junsik.reservation.enums.MemberRole;
import junsik.reservation.enums.RoomPriceSource;
import junsik.reservation.enums.RoomStatus;
import junsik.reservation.repository.AccommodationRepository;
import junsik.reservation.repository.RoomDailyPriceRepository;
import junsik.reservation.repository.RoomRepository;
import junsik.reservation.security.JwtTokenProvider;

@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class RoomDailyPriceIntegrationTest {

	@Autowired
	private MockMvc mockMvc;

	@Autowired
	private AccommodationRepository accommodationRepository;

	@Autowired
	private RoomRepository roomRepository;

	@Autowired
	private RoomDailyPriceRepository roomDailyPriceRepository;

	@Autowired
	private JwtTokenProvider jwtTokenProvider;

	@Test
	void createsDailyPriceWithAdminRole() throws Exception {
		Room room = saveRoom();

		mockMvc.perform(post(pricesUrl(room.getId()))
					.header("Authorization", adminBearer())
					.contentType(MediaType.APPLICATION_JSON)
					.content(createRequest("180000.00")))
				.andExpect(status().isCreated())
				.andExpect(header().string("Location", pricesUrl(room.getId()) + "/" + DEFAULT_STAY_DATE))
				.andExpect(jsonPath("$.roomDailyPriceId").isNumber())
				.andExpect(jsonPath("$.roomId").value(room.getId()))
				.andExpect(jsonPath("$.stayDate").value(DEFAULT_STAY_DATE.toString()))
				.andExpect(jsonPath("$.nightlyPrice").value(180000.00))
				.andExpect(jsonPath("$.source").value(RoomPriceSource.DAILY.name()));

		RoomDailyPrice saved = roomDailyPriceRepository.findByRoomIdAndStayDate(room.getId(), DEFAULT_STAY_DATE)
				.orElseThrow();
		assertThat(saved.getNightlyPrice()).isEqualByComparingTo("180000.00");
	}

	@Test
	void updatesAndQueriesDailyPrice() throws Exception {
		Room room = saveRoom();
		createDailyPrice(room, "180000.00");

		mockMvc.perform(put(priceUrl(room.getId()))
					.header("Authorization", adminBearer())
					.contentType(MediaType.APPLICATION_JSON)
					.content(updateRequest("210000.00")))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.nightlyPrice").value(210000.00))
				.andExpect(jsonPath("$.source").value("DAILY"));

		mockMvc.perform(get(priceUrl(room.getId()))
					.header("Authorization", userBearer()))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.nightlyPrice").value(210000.00))
				.andExpect(jsonPath("$.source").value("DAILY"));
	}

	@Test
	void returnsRoomDefaultPriceWhenDailyPriceDoesNotExist() throws Exception {
		Room room = saveRoom();

		mockMvc.perform(get(priceUrl(room.getId()))
					.header("Authorization", userBearer()))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.roomDailyPriceId").doesNotExist())
				.andExpect(jsonPath("$.roomId").value(room.getId()))
				.andExpect(jsonPath("$.stayDate").value(DEFAULT_STAY_DATE.toString()))
				.andExpect(jsonPath("$.nightlyPrice").value(100000.00))
				.andExpect(jsonPath("$.source").value(RoomPriceSource.DEFAULT.name()));
	}

	@Test
	void rejectsDuplicateAndUnknownDailyPriceChanges() throws Exception {
		Room room = saveRoom();
		createDailyPrice(room, "180000.00");

		mockMvc.perform(post(pricesUrl(room.getId()))
					.header("Authorization", adminBearer())
					.contentType(MediaType.APPLICATION_JSON)
					.content(createRequest("190000.00")))
				.andExpect(status().isConflict())
				.andExpect(jsonPath("$.code").value("ROOM_PRICE_002"));

		mockMvc.perform(put(pricesUrl(room.getId()) + "/2030-07-21")
					.header("Authorization", adminBearer())
					.contentType(MediaType.APPLICATION_JSON)
					.content(updateRequest("190000.00")))
				.andExpect(status().isNotFound())
				.andExpect(jsonPath("$.code").value("ROOM_PRICE_001"));

		mockMvc.perform(get(priceUrl(999999L))
					.header("Authorization", userBearer()))
				.andExpect(status().isNotFound())
				.andExpect(jsonPath("$.code").value("ROOM_001"));
	}

	@Test
	void rejectsInvalidDailyPrices() throws Exception {
		Room room = saveRoom();

		for (String price : new String[] {"0", "-0.01", "100000.001", "12345678901.00"}) {
			mockMvc.perform(post(pricesUrl(room.getId()))
						.header("Authorization", adminBearer())
						.contentType(MediaType.APPLICATION_JSON)
						.content(createRequest(price)))
					.andExpect(status().isBadRequest())
					.andExpect(jsonPath("$.code").value("COMMON_001"));
		}

		assertThat(roomDailyPriceRepository.count()).isZero();
	}

	@Test
	void restrictsPriceManagementToAdminAndRequiresAuthenticationForQuery() throws Exception {
		Room room = saveRoom();

		mockMvc.perform(post(pricesUrl(room.getId()))
					.header("Authorization", userBearer())
					.contentType(MediaType.APPLICATION_JSON)
					.content(createRequest("180000.00")))
				.andExpect(status().isForbidden())
				.andExpect(jsonPath("$.code").value("AUTH_002"));

		mockMvc.perform(get(priceUrl(room.getId())))
				.andExpect(status().isUnauthorized())
				.andExpect(jsonPath("$.code").value("AUTH_001"));
	}

	@Test
	void allowsAdminToPrepareDailyPriceForInactiveRoom() throws Exception {
		Room room = saveRoom();
		room.changeStatus(RoomStatus.INACTIVE);
		roomRepository.flush();

		mockMvc.perform(post(pricesUrl(room.getId()))
					.header("Authorization", adminBearer())
					.contentType(MediaType.APPLICATION_JSON)
					.content(createRequest("180000.00")))
				.andExpect(status().isCreated())
				.andExpect(jsonPath("$.source").value("DAILY"));
	}

	private Room saveRoom() {
		Accommodation accommodation = accommodationRepository.saveAndFlush(accommodation());
		return roomRepository.saveAndFlush(room(
				accommodation,
				"Deluxe Room",
				2,
				new BigDecimal("100000.00")
		));
	}

	private void createDailyPrice(Room room, String nightlyPrice) {
		roomDailyPriceRepository.saveAndFlush(RoomDailyPrice.create(
				room,
				DEFAULT_STAY_DATE,
				new BigDecimal(nightlyPrice)
		));
	}

	private String pricesUrl(Long roomId) {
		return "/api/v1/rooms/" + roomId + "/prices";
	}

	private String priceUrl(Long roomId) {
		return pricesUrl(roomId) + "/" + DEFAULT_STAY_DATE;
	}

	private String adminBearer() {
		return bearerToken(jwtTokenProvider, MemberRole.ADMIN);
	}

	private String userBearer() {
		return bearerToken(jwtTokenProvider, MemberRole.USER);
	}

	private String createRequest(String nightlyPrice) {
		return """
				{
				  "stayDate": "%s",
				  "nightlyPrice": %s
				}
				""".formatted(DEFAULT_STAY_DATE, nightlyPrice);
	}

	private String updateRequest(String nightlyPrice) {
		return "{\"nightlyPrice\":%s}".formatted(nightlyPrice);
	}
}
