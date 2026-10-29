package junsik.reservation.entity.media;

import java.time.Instant;
import jakarta.persistence.Column;
import jakarta.persistence.CheckConstraint;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.Table;
import lombok.Getter;

/** Durable unclaimed-file intent, also used for obsolete-file deletion after commit. */
@Getter
@Entity
@Table(name = "media_file_cleanup", indexes = @Index(name = "idx_media_cleanup_due", columnList = "next_attempt_at, storage_key"),
		check = @CheckConstraint(name = "chk_media_cleanup_attempts", constraint = "attempts >= 0"))
public class MediaFileCleanup {
	@Id
	@Column(name = "storage_key", length = 41)
	private String storageKey;
	@Column(name = "next_attempt_at", nullable = false)
	private Instant nextAttemptAt;
	@Column(nullable = false)
	private int attempts;
	@Column(name = "last_failure", length = 100)
	private String lastFailure;

	protected MediaFileCleanup() { }

	public MediaFileCleanup(String storageKey, Instant due) {
		this.storageKey = storageKey;
		this.nextAttemptAt = due;
	}

	public void failed(String cause, Instant retryAt) {
		attempts++;
		lastFailure = cause;
		nextAttemptAt = retryAt;
	}
}
