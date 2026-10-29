package junsik.reservation.support;

import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import javax.imageio.ImageIO;
import org.springframework.mock.web.MockMultipartFile;

public final class MediaUploadFixture {
	private MediaUploadFixture() { }

	public static byte[] png() { return image("png", 3, 2); }

	public static byte[] image(String format, int width, int height) {
		try {
			BufferedImage image = new BufferedImage(width, height, BufferedImage.TYPE_INT_RGB);
			try {
				image.setRGB(0, 0, 0x253b59);
				var output = new ByteArrayOutputStream();
				if (!ImageIO.write(image, format, output)) { throw new IllegalStateException("No fixture encoder"); }
				return output.toByteArray();
			} finally { image.flush(); }
		} catch (IOException exception) { throw new IllegalStateException(exception); }
	}

	public static MockMultipartFile file() { return new MockMultipartFile("file", "../../ignored.html", "text/html", png()); }

	public static MockMultipartFile metadata() {
		return new MockMultipartFile("metadata", "", "application/json", """
				{"altText":"격리된 테스트 픽셀", "source":"Generated BufferedImage fixture", "rightsRecord":"Test-only generated pixels, not property evidence"}
				""".getBytes(java.nio.charset.StandardCharsets.UTF_8));
	}
}
