package com.code76.store.media;

import org.springframework.http.CacheControl;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.Optional;
import java.util.concurrent.TimeUnit;

/**
 * Serves uploaded images publicly at /media/{key}.{ext}. A file never changes once uploaded
 * (a new upload gets a new key), so browsers and CDNs may cache it for a year.
 */
@RestController
public class MediaController {

    private final MediaService media;
    private final MediaVariants variants;

    public MediaController(MediaService media, MediaVariants variants) {
        this.media = media;
        this.variants = variants;
    }

    /** Add ?w=320|480|640|960|1280|1600 for a smaller copy (other widths get the original). */
    @GetMapping("/media/{file:[A-Za-z0-9]{8,32}\\.(?:jpg|png|webp)}")
    public ResponseEntity<byte[]> serve(@PathVariable String file,
                                        @RequestParam(value = "w", required = false) Integer width,
                                        @RequestHeader(value = HttpHeaders.IF_NONE_MATCH, required = false) String ifNoneMatch) {
        int dot = file.lastIndexOf('.');
        String key = file.substring(0, dot);
        String ext = file.substring(dot + 1);
        if (width != null && MediaVariants.WIDTHS.contains(width)) {
            Optional<MediaVariants.Variant> small = media.file(key).filter(f -> f.extension().equals(ext)).flatMap(f -> variants.get(key, width));
            if (small.isPresent()) {
                String etag = "\"" + key + "-" + width + "\"";
                ResponseEntity.BodyBuilder response = ResponseEntity.status(etag.equals(ifNoneMatch) ? HttpStatus.NOT_MODIFIED : HttpStatus.OK)
                        .eTag(key + "-" + width)
                        .cacheControl(CacheControl.maxAge(365, TimeUnit.DAYS).cachePublic().immutable())
                        .header("Content-Security-Policy", "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'")
                        .header(HttpHeaders.CONTENT_DISPOSITION, "inline")
                        .contentType(MediaType.parseMediaType(small.get().contentType()));
                return etag.equals(ifNoneMatch) ? response.<byte[]>build() : response.body(small.get().bytes());
            }
        }
        return media.file(key)
                .filter(f -> f.extension().equals(ext))
                .map(f -> {
                    String etag = "\"" + f.sha256() + "\"";
                    ResponseEntity.BodyBuilder response = ResponseEntity.status(etag.equals(ifNoneMatch) ? HttpStatus.NOT_MODIFIED : HttpStatus.OK)
                            .eTag(f.sha256())
                            .cacheControl(CacheControl.maxAge(365, TimeUnit.DAYS).cachePublic().immutable())
                            // Even if a file were somehow not an image, the browser must not run anything from it.
                            .header("Content-Security-Policy", "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'")
                            .header(HttpHeaders.CONTENT_DISPOSITION, "inline")
                            .contentType(MediaType.parseMediaType(f.contentType()));
                    return etag.equals(ifNoneMatch) ? response.<byte[]>build() : response.body(f.bytes());
                })
                .orElseGet(() -> ResponseEntity.notFound().build());
    }
}
