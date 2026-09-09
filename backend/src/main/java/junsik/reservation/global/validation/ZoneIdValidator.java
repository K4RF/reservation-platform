package junsik.reservation.global.validation;

import java.time.ZoneId;

import jakarta.validation.ConstraintValidator;
import jakarta.validation.ConstraintValidatorContext;

public class ZoneIdValidator implements ConstraintValidator<ValidZoneId, String> {

	@Override
	public boolean isValid(String value, ConstraintValidatorContext context) {
		return value == null
				|| value.isBlank()
				|| ZoneId.getAvailableZoneIds().contains(value.trim());
	}
}
