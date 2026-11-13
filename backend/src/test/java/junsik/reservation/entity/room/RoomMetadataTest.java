package junsik.reservation.entity.room;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatIllegalArgumentException;

import java.math.BigDecimal;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

class RoomMetadataTest {

	@Test
	void normalizesOuterWhitespaceAndKeepsLineBreaks() {
		RoomMetadata metadata = RoomMetadata.of("\u3000첫 줄\n둘째 줄  ", "\t  ", BigDecimal.ONE, " 바다 ");
		assertThat(metadata.getDescription()).isEqualTo("첫 줄\n둘째 줄");
		assertThat(metadata.getBedConfiguration()).isNull();
		assertThat(metadata.getAreaSquareMeters()).isEqualTo(new BigDecimal("1.00"));
		assertThat(metadata.getView()).isEqualTo("바다");
		assertThat(RoomMetadata.of(" ", null, null, "\u3000")).isNull();
	}

	@ParameterizedTest
	@ValueSource(strings = {"-0.01", "0", "0.001", "1.123", "10000"})
	void rejectsAreaOutsideBoundsOrScale(String area) {
		assertThatIllegalArgumentException().isThrownBy(() ->
				RoomMetadata.of(null, null, new BigDecimal(area), null));
	}
}
