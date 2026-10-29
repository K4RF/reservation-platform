package junsik.reservation.entity.media;

import static junsik.reservation.support.AccommodationFixture.accommodation;
import static junsik.reservation.support.CatalogMediaFixture.image;
import static org.assertj.core.api.Assertions.*;

import org.junit.jupiter.api.Test;
import junsik.reservation.enums.MediaFormat;

class CatalogMediaTest {
	@Test
	void validatesOwnershipKeyMetadataAndOrder() {
		CatalogMedia media = image(accommodation(), 5);
		assertThat(media.getAccommodation()).isNotNull();
		assertThat(media.getRoom()).isNull();
		assertThat(media.getSource()).isNotBlank();
		assertThat(media.getRightsRecord()).isNotBlank();
		assertThatThrownBy(() -> media.changeSortOrder(-1)).isInstanceOf(IllegalArgumentException.class);
		for (String key : new String[] {"../outside.png", "https://example.org/a.png", "file.png", "1-1-1-1-1.png"}) {
			assertThatThrownBy(() -> CatalogMedia.validateStorageKey(key, MediaFormat.PNG))
					.isInstanceOf(IllegalArgumentException.class);
		}
		assertThatThrownBy(() -> CatalogMedia.forAccommodation(accommodation(), media.getStorageKey(),
				MediaFormat.PNG, " ", 1, 1, 1, 0, "source", "rights"))
				.isInstanceOf(IllegalArgumentException.class);
		assertThatThrownBy(() -> CatalogMedia.forAccommodation(accommodation(), media.getStorageKey(),
				MediaFormat.PNG, "alt", 8193, 1, 1, 0, "source", "rights"))
				.isInstanceOf(IllegalArgumentException.class);
		assertThatThrownBy(() -> CatalogMedia.forAccommodation(accommodation(), media.getStorageKey(),
				MediaFormat.PNG, "alt", 1, 1, CatalogMedia.MAX_BYTES + 1, 0, "source", "rights"))
				.isInstanceOf(IllegalArgumentException.class);
	}
}
