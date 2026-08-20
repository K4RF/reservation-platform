package junsik.reservation.dto;

public record LoginResponse(
		String accessToken,
		String refreshToken,
		String tokenType
) {

	private static final String BEARER_TYPE = "Bearer";

	public static LoginResponse bearer(String accessToken, String refreshToken) {
		return new LoginResponse(accessToken, refreshToken, BEARER_TYPE);
	}
}
