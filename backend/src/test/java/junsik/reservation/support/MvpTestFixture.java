package junsik.reservation.support;

import java.time.LocalDate;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;

public final class MvpTestFixture {

	private final JdbcTemplate jdbcTemplate;
	private final PasswordEncoder passwordEncoder;

	public MvpTestFixture(JdbcTemplate jdbcTemplate, PasswordEncoder passwordEncoder) {
		this.jdbcTemplate = jdbcTemplate;
		this.passwordEncoder = passwordEncoder;
	}

	public void createAdmin(String email, String rawPassword) {
		jdbcTemplate.update(
				"insert into members (email, password, role) values (?, ?, 'ADMIN')",
				email,
				passwordEncoder.encode(rawPassword)
		);
	}

	public void createRoomInventory(
			Long roomId,
			LocalDate checkInDate,
			LocalDate checkOutDate,
			int totalQuantity
	) {
		checkInDate.datesUntil(checkOutDate).forEach(date -> jdbcTemplate.update(
				"""
				insert into room_inventories (room_id, inventory_date, total_quantity, reserved_quantity)
				values (?, ?, ?, 0)
				""",
				roomId,
				date,
				totalQuantity
		));
	}
}
