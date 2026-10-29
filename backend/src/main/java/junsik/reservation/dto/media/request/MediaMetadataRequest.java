package junsik.reservation.dto.media.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record MediaMetadataRequest(
		@NotBlank @Size(max = 300) String altText,
		@NotBlank @Size(max = 500) String source,
		@NotBlank @Size(max = 1000) String rightsRecord
) { }
