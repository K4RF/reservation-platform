package junsik.reservation.support;

import java.util.Base64;
import java.util.UUID;

import junsik.reservation.entity.accommodation.Accommodation;
import junsik.reservation.entity.media.CatalogMedia;
import junsik.reservation.entity.room.Room;
import junsik.reservation.enums.MediaFormat;

public final class CatalogMediaFixture {
	private CatalogMediaFixture() { }

	public static byte[] png() {
		return Base64.getDecoder().decode("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aWQAAAABJRU5ErkJggg==");
	}

	public static CatalogMedia image(Accommodation accommodation, int order) {
		return CatalogMedia.forAccommodation(accommodation, UUID.randomUUID() + ".png", MediaFormat.PNG,
				"격리된 이미지 Fixture", 1, 1, png().length, order, "Generated test pixel", "Test fixture only; not property evidence");
	}

	public static CatalogMedia image(Room room, int order) {
		return CatalogMedia.forRoom(room, UUID.randomUUID() + ".png", MediaFormat.PNG,
				"격리된 객실 이미지 Fixture", 1, 1, png().length, order, "Generated test pixel", "Test fixture only; not property evidence");
	}
}
