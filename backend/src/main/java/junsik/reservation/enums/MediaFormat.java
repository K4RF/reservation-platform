package junsik.reservation.enums;

public enum MediaFormat {

	JPEG("image/jpeg", "jpg"), PNG("image/png", "png"), WEBP("image/webp", "webp");

	private final String contentType;
	private final String extension;

	MediaFormat(String contentType, String extension) {
		this.contentType = contentType;
		this.extension = extension;
	}

	public String getContentType() {
		return contentType;
	}

	public String getExtension() {
		return extension;
	}
}
