package junsik.reservation.dto.auth.request;

import jakarta.validation.constraints.NotBlank;

public record OAuth2LoginCodeRequest(@NotBlank String code) {
}
