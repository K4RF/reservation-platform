package junsik.reservation.service.media;

import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.util.Iterator;
import java.util.Locale;
import javax.imageio.ImageIO;
import javax.imageio.ImageReader;
import javax.imageio.stream.MemoryCacheImageInputStream;

import org.springframework.stereotype.Component;
import org.springframework.web.multipart.MultipartFile;
import junsik.reservation.entity.media.CatalogMedia;
import junsik.reservation.enums.MediaErrorCode;
import junsik.reservation.enums.MediaFormat;
import junsik.reservation.global.exception.BusinessException;

@Component
public class ImageUploadValidator {
	public static final long MAX_PIXELS = 16_000_000;

	public ValidatedImage validate(MultipartFile file) {
		if (file == null || file.isEmpty() || file.getSize() > CatalogMedia.MAX_BYTES) { throw invalid(); }
		try {
			byte[] input;
			try (var stream = file.getInputStream()) { input = stream.readNBytes((int) CatalogMedia.MAX_BYTES + 1); }
			if (input.length == 0 || input.length > CatalogMedia.MAX_BYTES) { throw invalid(); }
			try (var stream = new MemoryCacheImageInputStream(new ByteArrayInputStream(input))) {
				Iterator<ImageReader> readers = ImageIO.getImageReaders(stream);
				if (!readers.hasNext()) { throw invalid(); }
				ImageReader reader = readers.next();
				BufferedImage image = null;
				try {
					reader.setInput(stream, true, true);
					MediaFormat format = switch (reader.getFormatName().toLowerCase(Locale.ROOT)) {
						case "jpeg", "jpg" -> MediaFormat.JPEG;
						case "png" -> MediaFormat.PNG;
						default -> throw invalid();
					};
					int width = reader.getWidth(0);
					int height = reader.getHeight(0);
					if (width < 1 || height < 1 || width > CatalogMedia.MAX_DIMENSION || height > CatalogMedia.MAX_DIMENSION
							|| (long) width * height > MAX_PIXELS) { throw invalid(); }
					image = reader.read(0);
					// Re-encode decoded pixels, never preserve submitted EXIF/extra trailing content.
					var output = new LimitedOutput();
					if (image == null || !ImageIO.write(image, format.getExtension(), output)) { throw invalid(); }
					return new ValidatedImage(output.toByteArray(), format, width, height);
				} finally {
					reader.dispose();
					if (image != null) { image.flush(); }
				}
			}
		} catch (IOException | IllegalArgumentException exception) {
			throw invalid();
		}
	}

	private static BusinessException invalid() { return new BusinessException(MediaErrorCode.INVALID_IMAGE); }

	private static class LimitedOutput extends ByteArrayOutputStream {
		@Override public synchronized void write(byte[] bytes, int offset, int length) {
			if ((long) count + length > CatalogMedia.MAX_BYTES) { throw invalid(); }
			super.write(bytes, offset, length);
		}
		@Override public synchronized void write(int value) {
			if (count >= CatalogMedia.MAX_BYTES) { throw invalid(); }
			super.write(value);
		}
	}

	public record ValidatedImage(byte[] bytes, MediaFormat format, int width, int height) { }
}
