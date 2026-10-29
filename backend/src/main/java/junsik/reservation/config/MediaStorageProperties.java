package junsik.reservation.config;

import java.nio.file.Path;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;

@ConfigurationProperties("reservation.media")
public record MediaStorageProperties(@DefaultValue(".local/media") Path root) { }
