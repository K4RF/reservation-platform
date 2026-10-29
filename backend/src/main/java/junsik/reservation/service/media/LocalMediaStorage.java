package junsik.reservation.service.media;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardOpenOption;
import java.util.Arrays;
import org.springframework.stereotype.Component;
import junsik.reservation.config.MediaStorageProperties;
import junsik.reservation.entity.media.CatalogMedia;
import junsik.reservation.enums.MediaFormat;

@Component
public class LocalMediaStorage {
	private final MediaStorageProperties properties;
	public LocalMediaStorage(MediaStorageProperties properties) { this.properties = properties; }

	public void write(String key, byte[] bytes) throws IOException {
		validateKey(key);
		Path root = Files.createDirectories(properties.root().toAbsolutePath().normalize()).toRealPath();
		// Never replace an existing key, including symlinks. Partial writes remain journaled.
		Files.write(root.resolve(key), bytes, StandardOpenOption.CREATE_NEW, StandardOpenOption.WRITE);
	}

	public void delete(String key) throws IOException {
		validateKey(key);
		Path root;
		try { root = properties.root().toAbsolutePath().normalize().toRealPath(); }
		catch (java.nio.file.NoSuchFileException absent) { return; }
		Path file = root.resolve(key);
		if (Files.isSymbolicLink(file) || (Files.exists(file, java.nio.file.LinkOption.NOFOLLOW_LINKS)
				&& !Files.isRegularFile(file, java.nio.file.LinkOption.NOFOLLOW_LINKS))) {
			throw new IOException("Refusing non-regular file cleanup");
		}
		Files.deleteIfExists(file);
	}

	private static void validateKey(String key) {
		MediaFormat format = Arrays.stream(MediaFormat.values())
				.filter(value -> key.endsWith("." + value.getExtension())).findFirst().orElseThrow(IllegalArgumentException::new);
		CatalogMedia.validateStorageKey(key, format);
	}
}
