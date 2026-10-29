package junsik.reservation.dto.media.request;

import java.util.List;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;

public record MediaOrderRequest(@NotNull @Size(max = 20) List<@NotNull @Positive Long> mediaIds) { }
