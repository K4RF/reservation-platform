package junsik.reservation.entity.media;

import java.util.Objects;
import java.util.UUID;

import jakarta.persistence.CheckConstraint;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.ForeignKey;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;

import junsik.reservation.entity.accommodation.Accommodation;
import junsik.reservation.entity.room.Room;
import junsik.reservation.enums.MediaFormat;
import lombok.Getter;

@Getter
@Entity
@Table(name = "catalog_media", uniqueConstraints = @UniqueConstraint(
		name = "uk_catalog_media_storage_key", columnNames = "storage_key"
), indexes = {
		@Index(name = "idx_catalog_media_accommodation_order", columnList = "accommodation_id, sort_order, id"),
		@Index(name = "idx_catalog_media_room_order", columnList = "room_id, sort_order, id")
}, check = {
		@CheckConstraint(name = "chk_catalog_media_owner", constraint =
				"(accommodation_id is not null and room_id is null) or (accommodation_id is null and room_id is not null)"),
		@CheckConstraint(name = "chk_catalog_media_dimensions", constraint =
				"width between 1 and 8192 and height between 1 and 8192 and byte_size between 1 and 10485760"),
		@CheckConstraint(name = "chk_catalog_media_order", constraint = "sort_order >= 0"),
		@CheckConstraint(name = "chk_catalog_media_text", constraint =
				"char_length(trim(alt_text)) > 0 and char_length(trim(source)) > 0 and char_length(trim(rights_record)) > 0")
})
public class CatalogMedia {

	public static final long MAX_BYTES = 10 * 1024 * 1024;
	public static final int MAX_DIMENSION = 8192;

	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	private Long id;

	@ManyToOne(fetch = FetchType.LAZY)
	@JoinColumn(name = "accommodation_id", foreignKey = @ForeignKey(name = "fk_catalog_media_accommodation"))
	private Accommodation accommodation;

	@ManyToOne(fetch = FetchType.LAZY)
	@JoinColumn(name = "room_id", foreignKey = @ForeignKey(name = "fk_catalog_media_room"))
	private Room room;

	@Column(name = "storage_key", nullable = false, length = 41, updatable = false)
	private String storageKey;

	@Enumerated(EnumType.STRING)
	@Column(nullable = false, length = 10, updatable = false)
	private MediaFormat format;

	@Column(name = "alt_text", nullable = false, length = 300)
	private String altText;

	@Column(nullable = false, updatable = false)
	private int width;

	@Column(nullable = false, updatable = false)
	private int height;

	@Column(name = "byte_size", nullable = false, updatable = false)
	private long byteSize;

	@Column(name = "sort_order", nullable = false)
	private int sortOrder;

	@Column(nullable = false, length = 500)
	private String source;

	@Column(name = "rights_record", nullable = false, length = 1000)
	private String rightsRecord;

	protected CatalogMedia() { }

	private CatalogMedia(Accommodation accommodation, Room room, String storageKey, MediaFormat format,
			String altText, int width, int height, long byteSize, int sortOrder, String source, String rightsRecord) {
		if ((accommodation == null) == (room == null)) {
			throw new IllegalArgumentException("Media must belong to exactly one accommodation or room");
		}
		this.accommodation = accommodation;
		this.room = room;
		this.format = Objects.requireNonNull(format);
		validateStorageKey(storageKey, format);
		this.storageKey = storageKey;
		this.altText = requiredText(altText, 300);
		this.source = requiredText(source, 500);
		this.rightsRecord = requiredText(rightsRecord, 1000);
		if (width < 1 || width > MAX_DIMENSION || height < 1 || height > MAX_DIMENSION
				|| byteSize < 1 || byteSize > MAX_BYTES) {
			throw new IllegalArgumentException("Media dimensions or byte size out of range");
		}
		this.width = width;
		this.height = height;
		this.byteSize = byteSize;
		changeSortOrder(sortOrder);
	}

	public static CatalogMedia forAccommodation(Accommodation owner, String key, MediaFormat format,
			String alt, int width, int height, long bytes, int order, String source, String rights) {
		return new CatalogMedia(Objects.requireNonNull(owner), null, key, format, alt, width, height, bytes, order, source, rights);
	}

	public static CatalogMedia forRoom(Room owner, String key, MediaFormat format,
			String alt, int width, int height, long bytes, int order, String source, String rights) {
		return new CatalogMedia(null, Objects.requireNonNull(owner), key, format, alt, width, height, bytes, order, source, rights);
	}

	public void changeSortOrder(int order) {
		if (order < 0) { throw new IllegalArgumentException("Media sort order must be non-negative"); }
		this.sortOrder = order;
	}

	public static void validateStorageKey(String key, MediaFormat format) {
		Objects.requireNonNull(key);
		String suffix = "." + format.getExtension();
		if (!key.endsWith(suffix)) { throw new IllegalArgumentException("Invalid media key extension"); }
		String uuid = key.substring(0, key.length() - suffix.length());
		if (!UUID.fromString(uuid).toString().equals(uuid)) {
			throw new IllegalArgumentException("Media key must be a canonical UUID filename");
		}
	}

	private static String requiredText(String value, int max) {
		if (value == null || value.isBlank() || value.length() > max) {
			throw new IllegalArgumentException("Required media text is missing or too long");
		}
		return value.trim();
	}
}
