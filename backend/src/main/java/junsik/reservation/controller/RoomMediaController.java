package junsik.reservation.controller;

import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import junsik.reservation.config.OpenApiConfig;
import junsik.reservation.enums.MediaOwnerType;
import junsik.reservation.service.media.MediaManagementService;
import junsik.reservation.service.media.MediaUploadCoordinator;

@RestController
@Validated
@RequestMapping("/api/v1/rooms/{ownerId}/media")
@SecurityRequirement(name = OpenApiConfig.BEARER_AUTH)
@Tag(name = "Room Media (ADMIN)")
public class RoomMediaController extends AbstractMediaManagementController {
	public RoomMediaController(MediaManagementService service, MediaUploadCoordinator upload) {
		super(MediaOwnerType.ROOM, service, upload);
	}
}
