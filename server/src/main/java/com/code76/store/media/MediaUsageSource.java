package com.code76.store.media;

import java.util.List;

/**
 * Something that can reference uploaded images (products, collections, website sections).
 * Before an image is deleted, every source is asked where it's used, so nothing on the live site breaks.
 */
public interface MediaUsageSource {

    /** Human-readable places where this image URL is used, e.g. "Product: Form Oversized Tee". */
    List<String> usagesOf(String mediaUrl);
}
