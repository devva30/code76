package com.code76.store.media;

import java.util.Optional;

/**
 * Identifies an image by its first bytes (its "magic number"), never by the file name, and reads
 * its width and height from the header without decoding the picture. That way a renamed script or
 * HTML file is rejected, and an oversized "image bomb" is never unpacked in memory.
 * Supports JPEG, PNG and WebP. SVG is deliberately not accepted: it can contain scripts.
 */
public final class ImageInspector {

    private ImageInspector() {
    }

    public record ImageInfo(String contentType, String extension, int width, int height) {
    }

    public static Optional<ImageInfo> inspect(byte[] b) {
        if (b == null || b.length < 30) {
            return Optional.empty();
        }
        if (u8(b, 0) == 0x89 && b[1] == 'P' && b[2] == 'N' && b[3] == 'G') {
            return png(b);
        }
        if (u8(b, 0) == 0xFF && u8(b, 1) == 0xD8 && u8(b, 2) == 0xFF) {
            return jpeg(b);
        }
        if (b[0] == 'R' && b[1] == 'I' && b[2] == 'F' && b[3] == 'F' && b[8] == 'W' && b[9] == 'E' && b[10] == 'B' && b[11] == 'P') {
            return webp(b);
        }
        return Optional.empty();
    }

    /** PNG: width and height are the first fields of the IHDR chunk, right after the signature. */
    private static Optional<ImageInfo> png(byte[] b) {
        if (!(b[12] == 'I' && b[13] == 'H' && b[14] == 'D' && b[15] == 'R')) {
            return Optional.empty();
        }
        return sized("image/png", "png", be32(b, 16), be32(b, 20));
    }

    /** JPEG: walk the segments until a "start of frame" marker, which holds the dimensions. */
    private static Optional<ImageInfo> jpeg(byte[] b) {
        int i = 2;
        while (i + 9 < b.length) {
            if (u8(b, i) != 0xFF) {
                return Optional.empty();
            }
            int marker = u8(b, i + 1);
            if (marker == 0xFF) {
                i++;
                continue;
            }
            int length = be16(b, i + 2);
            boolean startOfFrame = marker >= 0xC0 && marker <= 0xCF && marker != 0xC4 && marker != 0xC8 && marker != 0xCC;
            if (startOfFrame) {
                return sized("image/jpeg", "jpg", be16(b, i + 7), be16(b, i + 5));
            }
            if (length < 2) {
                return Optional.empty();
            }
            i += 2 + length;
        }
        return Optional.empty();
    }

    /** WebP comes in three flavours (lossy VP8, lossless VP8L, extended VP8X), each storing size differently. */
    private static Optional<ImageInfo> webp(byte[] b) {
        String chunk = new String(b, 12, 4, java.nio.charset.StandardCharsets.US_ASCII);
        return switch (chunk) {
            case "VP8X" -> sized("image/webp", "webp", 1 + le24(b, 24), 1 + le24(b, 27));
            case "VP8 " -> (u8(b, 23) == 0x9D && u8(b, 24) == 0x01 && u8(b, 25) == 0x2A)
                    ? sized("image/webp", "webp", le16(b, 26) & 0x3FFF, le16(b, 28) & 0x3FFF)
                    : Optional.empty();
            case "VP8L" -> {
                if (u8(b, 20) != 0x2F) {
                    yield Optional.empty();
                }
                int bits = u8(b, 21) | (u8(b, 22) << 8) | (u8(b, 23) << 16) | (u8(b, 24) << 24);
                yield sized("image/webp", "webp", (bits & 0x3FFF) + 1, ((bits >> 14) & 0x3FFF) + 1);
            }
            default -> Optional.empty();
        };
    }

    private static Optional<ImageInfo> sized(String type, String ext, int width, int height) {
        return width > 0 && height > 0 ? Optional.of(new ImageInfo(type, ext, width, height)) : Optional.empty();
    }

    private static int u8(byte[] b, int i) {
        return b[i] & 0xFF;
    }

    private static int be16(byte[] b, int i) {
        return (u8(b, i) << 8) | u8(b, i + 1);
    }

    private static int be32(byte[] b, int i) {
        return (u8(b, i) << 24) | (u8(b, i + 1) << 16) | (u8(b, i + 2) << 8) | u8(b, i + 3);
    }

    private static int le16(byte[] b, int i) {
        return u8(b, i) | (u8(b, i + 1) << 8);
    }

    private static int le24(byte[] b, int i) {
        return u8(b, i) | (u8(b, i + 1) << 8) | (u8(b, i + 2) << 16);
    }
}
