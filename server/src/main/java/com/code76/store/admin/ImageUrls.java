package com.code76.store.admin;

import com.code76.store.common.error.InvalidRequestException;
import com.code76.store.media.MediaService;
import org.springframework.stereotype.Component;

import java.util.regex.Pattern;

/**
 * Every image the admin puts on the site must be one of ours: an uploaded image from the media
 * library, or one of the original photos shipped with the site. Outside links (tracking pixels,
 * hot-linked photos, javascript: tricks) are refused.
 */
@Component
public class ImageUrls {

    private static final Pattern BUNDLED = Pattern.compile("^/images/[a-z0-9/_-]+\\.(webp|jpg|jpeg|png)$");

    private final MediaService media;

    public ImageUrls(MediaService media) {
        this.media = media;
    }

    public boolean isAllowed(String url) {
        return url != null && (BUNDLED.matcher(url).matches() || media.exists(url));
    }

    /** Returns the URL, or throws a field error naming where the bad image was. */
    public String require(String url, String field) {
        if (!isAllowed(url)) {
            throw new InvalidRequestException(field, "must be an image from the media library");
        }
        return url;
    }

    /** Blank means "no image"; anything else must be allowed. */
    public String optional(String url, String field) {
        return url == null || url.isBlank() ? null : require(url.trim(), field);
    }
}
