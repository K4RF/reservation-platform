package junsik.reservation.dto.media.response;

import io.swagger.v3.oas.annotations.media.Schema;
import junsik.reservation.entity.media.CatalogMedia;

@Schema(description = "공개 이미지 메타데이터. URL은 API origin 기준 상대 경로이며 저장된 이미지 파일을 제공한다(업로드 시 재인코딩). width/height로 비율을 계산한다.")
public record MediaResponse(
		Long mediaId,
		@Schema(example = "/api/v1/media/1/content") String url,
		String altText,
		int width,
		int height,
		long byteSize,
		String contentType,
		int sortOrder
) {
	public static MediaResponse from(CatalogMedia media) {
		return new MediaResponse(media.getId(), "/api/v1/media/" + media.getId() + "/content",
				media.getAltText(), media.getWidth(), media.getHeight(), media.getByteSize(),
				media.getFormat().getContentType(), media.getSortOrder());
	}
}
