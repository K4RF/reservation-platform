package junsik.reservation.dto;

public record ReissueTokenResponse(
		String accessToken,
		String tokenType
) {

	private static final String BEARER_TYPE = "Bearer";

	public static ReissueTokenResponse bearer(String accessToken) {
		return new ReissueTokenResponse(accessToken, BEARER_TYPE);
	}
}
