package junsik.reservation.entity.room;

import java.math.BigDecimal;
import java.math.RoundingMode;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;

@Embeddable
public class RoomMetadata {

	public static final int DESCRIPTION_MAX_LENGTH = 1000;
	public static final int BED_CONFIGURATION_MAX_LENGTH = 100;
	public static final int VIEW_MAX_LENGTH = 100;
	public static final String MIN_AREA = "0.01";
	public static final String MAX_AREA = "9999.99";

	@Column(name = "metadata_description", length = DESCRIPTION_MAX_LENGTH)
	private String description;
	@Column(name = "metadata_bed_configuration", length = BED_CONFIGURATION_MAX_LENGTH)
	private String bedConfiguration;
	@Column(name = "metadata_area_square_meters", precision = 6, scale = 2)
	private BigDecimal areaSquareMeters;
	@Column(name = "metadata_view", length = VIEW_MAX_LENGTH)
	private String view;

	protected RoomMetadata() {
	}

	private RoomMetadata(String description, String bedConfiguration, BigDecimal areaSquareMeters, String view) {
		this.description = description;
		this.bedConfiguration = bedConfiguration;
		this.areaSquareMeters = areaSquareMeters;
		this.view = view;
	}

	public static RoomMetadata of(String description, String bedConfiguration, BigDecimal areaSquareMeters, String view) {
		String cleanDescription = normalize(description, DESCRIPTION_MAX_LENGTH);
		String cleanBed = normalize(bedConfiguration, BED_CONFIGURATION_MAX_LENGTH);
		String cleanView = normalize(view, VIEW_MAX_LENGTH);
		if (areaSquareMeters != null) {
			if (areaSquareMeters.compareTo(new BigDecimal(MIN_AREA)) < 0
					|| areaSquareMeters.compareTo(new BigDecimal(MAX_AREA)) > 0 || areaSquareMeters.scale() > 2) {
				throw new IllegalArgumentException("Room area must be 0.01–9999.99 m² with at most two decimals");
			}
			areaSquareMeters = areaSquareMeters.setScale(2, RoundingMode.UNNECESSARY);
		}
		if (cleanDescription == null && cleanBed == null && areaSquareMeters == null && cleanView == null) {
			return null;
		}
		return new RoomMetadata(cleanDescription, cleanBed, areaSquareMeters, cleanView);
	}

	private static String normalize(String text, int maxLength) {
		if (text == null) return null;
		if (text.length() > maxLength) throw new IllegalArgumentException("Room metadata exceeds its maximum length");
		String stripped = text.strip();
		return stripped.isEmpty() ? null : stripped;
	}

	public String getDescription() {
		return description;
	}

	public String getBedConfiguration() {
		return bedConfiguration;
	}

	public BigDecimal getAreaSquareMeters() {
		return areaSquareMeters;
	}

	public String getView() {
		return view;
	}
}
