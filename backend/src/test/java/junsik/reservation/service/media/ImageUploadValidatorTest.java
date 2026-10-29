package junsik.reservation.service.media;

import static org.assertj.core.api.Assertions.*;
import static junsik.reservation.support.MediaUploadFixture.*;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockMultipartFile;
import junsik.reservation.enums.MediaFormat;
import junsik.reservation.global.exception.BusinessException;

class ImageUploadValidatorTest {
	private final ImageUploadValidator validator = new ImageUploadValidator();

	@Test
	void decodesActualPixelsAndIgnoresSubmittedFilenameAndMime() {
		var result = validator.validate(file());
		assertThat(result.format()).isEqualTo(MediaFormat.PNG);
		assertThat(result.width()).isEqualTo(3);
		assertThat(result.height()).isEqualTo(2);
		var jpeg = validator.validate(new MockMultipartFile("file", "fake.png", "image/png", image("jpeg", 4, 2)));
		assertThat(jpeg.format()).isEqualTo(MediaFormat.JPEG);
	}

	@Test
	void rejectsInvalidOversizedUnsupportedAndExcessivePixelUploads() {
		for (byte[] bytes : new byte[][] {new byte[0], "<svg>not a PNG</svg>".getBytes(),
				new byte[10 * 1024 * 1024 + 1], image("gif", 1, 1), image("png", 8193, 1), image("png", 4001, 4000)}) {
			assertThatThrownBy(() -> validator.validate(new MockMultipartFile("file", "f.png", "image/png", bytes)))
					.isInstanceOf(BusinessException.class);
		}
	}

	@Test
	void reencodingDropsTrailingPayload() {
		byte[] pixels = png();
		byte[] appended = java.util.Arrays.copyOf(pixels, pixels.length + 12);
		System.arraycopy("<script>x</s".getBytes(), 0, appended, pixels.length, 12);
		var result = validator.validate(new MockMultipartFile("file", "x.png", "image/png", appended));
		assertThat(new String(result.bytes(), java.nio.charset.StandardCharsets.ISO_8859_1)).doesNotContain("<script>");
	}
}
