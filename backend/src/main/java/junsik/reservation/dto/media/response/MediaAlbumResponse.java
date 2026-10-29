package junsik.reservation.dto.media.response;

import java.util.List;
import io.swagger.v3.oas.annotations.media.Schema;
import junsik.reservation.entity.media.CatalogMedia;
import junsik.reservation.enums.MediaOwnerType;

@Schema(description = "ADMIN 전용 DB 직접 조회. revision의 따옴표를 포함한 ETag를 모든 쓰기의 If-Match로 전달. 실패 시 자동 재실행 없이 GET 후 명시적으로 재검토")
public record MediaAlbumResponse(MediaOwnerType ownerType, Long ownerId, String revision, List<Item> images) {
	public MediaAlbumResponse { images = List.copyOf(images); }

	public record Item(MediaResponse image, String source, String rightsRecord) {
		public static Item from(CatalogMedia media) {
			return new Item(MediaResponse.from(media), media.getSource(), media.getRightsRecord());
		}
	}
}
