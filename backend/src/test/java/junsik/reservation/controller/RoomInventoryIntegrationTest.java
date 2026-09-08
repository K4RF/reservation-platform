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
import static junsik.reservation.support.MemberFixture.member;
import static junsik.reservation.support.RoomFixture.room;

import java.time.LocalDate;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import junsik.reservation.entity.Accommodation;
import junsik.reservation.entity.Member;
import junsik.reservation.entity.Room;
import junsik.reservation.entity.RoomInventory;
import junsik.reservation.enums.MemberRole;
import junsik.reservation.enums.ReservationStatus;
import junsik.reservation.enums.RoomInventorySaleStatus;
import junsik.reservation.repository.AccommodationRepository;
import junsik.reservation.repository.MemberRepository;
import junsik.reservation.repository.ReservationRepository;
import junsik.reservation.repository.RoomInventoryRepository;
import junsik.reservation.repository.RoomRepository;
import junsik.reservation.security.JwtTokenProvider;

@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class RoomInventoryIntegrationTest {

	private static final LocalDate START_DATE = LocalDate.of(2030, 7, 20);
	private static final LocalDate END_DATE = START_DATE.plusDays(2);

	@Autowired
	private MockMvc mockMvc;

	@Autowired
	private AccommodationRepository accommodationRepository;

	@Autowired
	private RoomRepository roomRepository;

	@Autowired
	private RoomInventoryRepository roomInventoryRepository;

	@Autowired
	private MemberRepository memberRepository;

	@Autowired
	private ReservationRepository reservationRepository;

	@Autowired
	private JwtTokenProvider jwtTokenProvider;

	@Test
	void createsOpenInventoryWithAdminRole() throws Exception {
		Room room = saveRoom();

		mockMvc.perform(post(inventoriesUrl(room.getId()))
					.header("Authorization", adminBearer())
					.contentType(MediaType.APPLICATION_JSON)
					.content(createRequest(START_DATE, 10)))
				.andExpect(status().isCreated())
				.andExpect(header().string("Location", inventoryUrl(room.getId(), START_DATE)))
				.andExpect(jsonPath("$.inventoryId").isNumber())
				.andExpect(jsonPath("$.roomId").value(room.getId()))
				.andExpect(jsonPath("$.inventoryDate").value(START_DATE.toString()))
				.andExpect(jsonPath("$.totalQuantity").value(10))
				.andExpect(jsonPath("$.reservedQuantity").value(0))
				.andExpect(jsonPath("$.availableQuantity").value(10))
				.andExpect(jsonPath("$.saleStatus").value("OPEN"));

		assertThat(roomInventoryRepository.findByRoomIdAndInventoryDate(room.getId(), START_DATE))
				.get()
				.extracting(RoomInventory::getSaleStatus)
				.isEqualTo(RoomInventorySaleStatus.OPEN);
	}

	@Test
	void returnsInclusiveCalendarInDateOrder() throws Exception {
		Room room = saveRoom();
		saveInventory(room, END_DATE, 3);
		saveInventory(room, START_DATE.minusDays(1), 1);
		saveInventory(room, START_DATE, 2);

		mockMvc.perform(get(inventoriesUrl(room.getId()))
					.header("Authorization", adminBearer())
					.param("startDate", START_DATE.toString())
					.param("endDate", END_DATE.toString()))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.roomId").value(room.getId()))
				.andExpect(jsonPath("$.startDate").value(START_DATE.toString()))
				.andExpect(jsonPath("$.endDate").value(END_DATE.toString()))
				.andExpect(jsonPath("$.inventories.length()").value(2))
				.andExpect(jsonPath("$.inventories[0].inventoryDate").value(START_DATE.toString()))
				.andExpect(jsonPath("$.inventories[1].inventoryDate").value(END_DATE.toString()));
	}

	@Test
	void updatesTotalQuantityAndSaleStatus() throws Exception {
		Room room = saveRoom();
		RoomInventory inventory = saveInventory(room, START_DATE, 5);
		inventory.reserve(2);

		mockMvc.perform(put(inventoryUrl(room.getId(), START_DATE))
					.header("Authorization", adminBearer())
					.contentType(MediaType.APPLICATION_JSON)
					.content(updateRequest(4, "CLOSED")))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.totalQuantity").value(4))
				.andExpect(jsonPath("$.reservedQuantity").value(2))
				.andExpect(jsonPath("$.availableQuantity").value(2))
				.andExpect(jsonPath("$.saleStatus").value("CLOSED"));

		assertThat(inventory.getSaleStatus()).isEqualTo(RoomInventorySaleStatus.CLOSED);
	}

	@Test
	void rejectsTotalQuantityBelowExistingReservations() throws Exception {
		Room room = saveRoom();
		RoomInventory inventory = saveInventory(room, START_DATE, 3);
		inventory.reserve(2);

		mockMvc.perform(put(inventoryUrl(room.getId(), START_DATE))
					.header("Authorization", adminBearer())
					.contentType(MediaType.APPLICATION_JSON)
					.content(updateRequest(1, "CLOSED")))
				.andExpect(status().isConflict())
				.andExpect(jsonPath("$.code").value("INVENTORY_006"));

		assertThat(inventory.getTotalQuantity()).isEqualTo(3);
		assertThat(inventory.getSaleStatus()).isEqualTo(RoomInventorySaleStatus.OPEN);
	}

	@Test
	void restrictsAllInventoryManagementEndpointsToAdmin() throws Exception {
		Room room = saveRoom();
		saveInventory(room, START_DATE, 3);

		mockMvc.perform(post(inventoriesUrl(room.getId()))
					.header("Authorization", userBearer(1L))
					.contentType(MediaType.APPLICATION_JSON)
					.content(createRequest(END_DATE, 3)))
				.andExpect(status().isForbidden())
				.andExpect(jsonPath("$.code").value("AUTH_002"));

		mockMvc.perform(put(inventoryUrl(room.getId(), START_DATE))
					.header("Authorization", userBearer(1L))
					.contentType(MediaType.APPLICATION_JSON)
					.content(updateRequest(3, "OPEN")))
				.andExpect(status().isForbidden());

		mockMvc.perform(get(inventoriesUrl(room.getId()))
					.header("Authorization", userBearer(1L))
					.param("startDate", START_DATE.toString())
					.param("endDate", END_DATE.toString()))
				.andExpect(status().isForbidden());
	}

	@Test
	void rejectsReversedCalendarPeriod() throws Exception {
		Room room = saveRoom();

		mockMvc.perform(get(inventoriesUrl(room.getId()))
					.header("Authorization", adminBearer())
					.param("startDate", END_DATE.toString())
					.param("endDate", START_DATE.toString()))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.code").value("INVENTORY_010"));
	}

	@Test
	void closedInventoryIsExcludedFromAvailabilityAndBlocksNewReservation() throws Exception {
		Room room = saveRoom();
		Member member = memberRepository.saveAndFlush(member("closed-inventory@example.com"));
		START_DATE.datesUntil(END_DATE).forEach(date -> saveInventory(room, date, 2));
		closeInventory(room, START_DATE.plusDays(1), 2);

		mockMvc.perform(get("/api/v1/accommodations/" + room.getAccommodation().getId() + "/rooms/available")
					.header("Authorization", userBearer(member.getId()))
					.param("checkInDate", START_DATE.toString())
					.param("checkOutDate", END_DATE.toString())
					.param("guestCount", "1"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.totalElements").value(0));

		mockMvc.perform(post("/api/v1/reservations")
					.header("Authorization", userBearer(member.getId()))
					.contentType(MediaType.APPLICATION_JSON)
					.content(reservationRequest(room.getId(), START_DATE, END_DATE)))
				.andExpect(status().isConflict())
				.andExpect(jsonPath("$.code").value("INVENTORY_009"));

		assertThat(reservationRepository.count()).isZero();
		assertThat(roomInventoryRepository
				.findAllByRoomIdAndInventoryDateBetweenOrderByInventoryDateAsc(
						room.getId(), START_DATE, END_DATE.minusDays(1)
				))
				.extracting(RoomInventory::getReservedQuantity)
				.containsOnly(0);
	}

	@Test
	void closingInventoryDoesNotChangeExistingReservation() throws Exception {
		Room room = saveRoom();
		Member member = memberRepository.saveAndFlush(member("existing-reservation@example.com"));
		START_DATE.datesUntil(END_DATE).forEach(date -> saveInventory(room, date, 2));

		mockMvc.perform(post("/api/v1/reservations")
					.header("Authorization", userBearer(member.getId()))
					.contentType(MediaType.APPLICATION_JSON)
					.content(reservationRequest(room.getId(), START_DATE, END_DATE)))
				.andExpect(status().isCreated());

		closeInventory(room, START_DATE, 2);
		Long reservationId = reservationRepository.findAll().getFirst().getId();

		mockMvc.perform(get("/api/v1/reservations/" + reservationId)
					.header("Authorization", userBearer(member.getId())))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.status").value(ReservationStatus.CONFIRMED.name()));

		RoomInventory inventory = roomInventoryRepository
				.findByRoomIdAndInventoryDate(room.getId(), START_DATE)
				.orElseThrow();
		assertThat(inventory.getReservedQuantity()).isOne();
		assertThat(inventory.getSaleStatus()).isEqualTo(RoomInventorySaleStatus.CLOSED);
	}

	private Room saveRoom() {
		Accommodation accommodation = accommodationRepository.saveAndFlush(accommodation());
		return roomRepository.saveAndFlush(room(accommodation));
	}

	private RoomInventory saveInventory(Room room, LocalDate date, int totalQuantity) {
		return roomInventoryRepository.saveAndFlush(RoomInventory.create(room, date, totalQuantity));
	}

	private void closeInventory(Room room, LocalDate date, int totalQuantity) throws Exception {
		mockMvc.perform(put(inventoryUrl(room.getId(), date))
					.header("Authorization", adminBearer())
					.contentType(MediaType.APPLICATION_JSON)
					.content(updateRequest(totalQuantity, "CLOSED")))
				.andExpect(status().isOk());
	}

	private String inventoriesUrl(Long roomId) {
		return "/api/v1/rooms/" + roomId + "/inventories";
	}

	private String inventoryUrl(Long roomId, LocalDate date) {
		return inventoriesUrl(roomId) + "/" + date;
	}

	private String adminBearer() {
		return bearerToken(jwtTokenProvider, MemberRole.ADMIN);
	}

	private String userBearer(Long memberId) {
		return bearerToken(jwtTokenProvider, memberId, MemberRole.USER);
	}

	private String createRequest(LocalDate inventoryDate, int totalQuantity) {
		return """
				{
				  "inventoryDate": "%s",
				  "totalQuantity": %d
				}
				""".formatted(inventoryDate, totalQuantity);
	}

	private String updateRequest(int totalQuantity, String saleStatus) {
		return """
				{
				  "totalQuantity": %d,
				  "saleStatus": "%s"
				}
				""".formatted(totalQuantity, saleStatus);
	}

	private String reservationRequest(Long roomId, LocalDate checkInDate, LocalDate checkOutDate) {
		return """
				{
				  "roomId": %d,
				  "guestCount": 1,
				  "checkInDate": "%s",
				  "checkOutDate": "%s"
				}
				""".formatted(roomId, checkInDate, checkOutDate);
	}
}
