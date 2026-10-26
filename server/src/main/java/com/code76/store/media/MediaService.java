package com.code76.store.media;

import com.code76.store.accounts.security.AccountPrincipal;
import com.code76.store.admin.audit.AdminAuditService;
import com.code76.store.catalogue.dto.CatalogueDtos.PageResponse;
import com.code76.store.common.error.ApiError.FieldProblem;
import com.code76.store.common.error.ApiException;
import com.code76.store.common.error.ConflictException;
import com.code76.store.common.error.ResourceNotFoundException;
import com.code76.store.media.MediaRepository.MediaSummary;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Instant;
import java.util.HexFormat;
import java.util.List;
import java.util.Locale;
import java.util.Optional;

/** The media library: upload once, use anywhere on the site. */
@Service
@Transactional
public class MediaService {

    public static final int MAX_BYTES = 10 * 1024 * 1024;
    public static final int MAX_DIMENSION = 8000;
    private static final char[] KEY_ALPHABET = "abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789".toCharArray();

    public record MediaDto(Long id, String url, String fileName, String contentType, int sizeBytes, int width, int height,
                           String altText, Instant createdAt) {
        static MediaDto of(MediaSummary m) {
            return new MediaDto(m.id(), m.url(), m.fileName(), m.contentType(), m.sizeBytes(), m.width(), m.height(), m.altText(), m.createdAt());
        }
    }

    private final MediaRepository media;
    private final List<MediaUsageSource> usageSources;
    private final AdminAuditService audit;
    private final MediaVariants variants;
    private final SecureRandom random = new SecureRandom();

    public MediaService(MediaRepository media, List<MediaUsageSource> usageSources, AdminAuditService audit, MediaVariants variants) {
        this.media = media;
        this.usageSources = usageSources;
        this.audit = audit;
        this.variants = variants;
    }

    public MediaDto upload(byte[] bytes, String originalName, String altText, AccountPrincipal admin) {
        if (bytes == null || bytes.length == 0) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "EMPTY_FILE", "Choose an image to upload.");
        }
        if (bytes.length > MAX_BYTES) {
            throw new ApiException(HttpStatus.CONTENT_TOO_LARGE, "FILE_TOO_LARGE", "Images can be at most 10 MB.");
        }
        ImageInspector.ImageInfo info = ImageInspector.inspect(bytes).orElseThrow(() ->
                new ApiException(HttpStatus.UNSUPPORTED_MEDIA_TYPE, "UNSUPPORTED_IMAGE", "Upload a JPEG, PNG or WebP image."));
        if (info.width() > MAX_DIMENSION || info.height() > MAX_DIMENSION) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "IMAGE_TOO_BIG", "Images can be at most 8000 × 8000 pixels.");
        }
        String alt = clean(altText, 300);
        String sha = sha256(bytes);
        Optional<MediaSummary> same = media.findSummaryBySha256(sha);
        if (same.isPresent()) {
            return MediaDto.of(same.get()); // this exact file is already in the library
        }
        MediaAsset asset = media.saveAndFlush(new MediaAsset(newKey(), safeFileName(originalName, info.extension()), info, bytes, sha, alt, admin.getId()));
        audit.record(admin, "MEDIA_UPLOADED", "media", asset.getId(),
                "Uploaded " + asset.getFileName() + " (" + info.width() + "×" + info.height() + ")");
        String key = asset.getPublicKey();
        if (org.springframework.transaction.support.TransactionSynchronizationManager.isSynchronizationActive()) {
            org.springframework.transaction.support.TransactionSynchronizationManager.registerSynchronization(
                    new org.springframework.transaction.support.TransactionSynchronization() {
                        @Override
                        public void afterCommit() {
                            variants.prepareAll(key);
                        }
                    });
        }
        return MediaDto.of(media.findSummary(asset.getId()).orElseThrow());
    }

    @Transactional(readOnly = true)
    public PageResponse<MediaDto> list(String query, int page, int pageSize) {
        String q = query == null ? "" : query.trim().toLowerCase(Locale.ROOT);
        String pattern = "%" + q.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_") + "%";
        Page<MediaSummary> result = media.search(q, pattern, PageRequest.of(page, pageSize));
        return new PageResponse<>(result.getContent().stream().map(MediaDto::of).toList(),
                result.getNumber(), result.getSize(), result.getTotalElements(), result.getTotalPages());
    }

    public MediaDto updateAltText(Long id, String altText, AccountPrincipal admin) {
        MediaAsset asset = media.findById(id).orElseThrow(() -> new ResourceNotFoundException("No image with id " + id + "."));
        asset.setAltText(clean(altText, 300));
        audit.record(admin, "MEDIA_UPDATED", "media", id, "Changed the description of " + asset.getFileName());
        return MediaDto.of(media.findSummary(id).orElseThrow());
    }

    /** Refuses while the image is still shown anywhere, and says where. */
    public void delete(Long id, AccountPrincipal admin) {
        MediaSummary asset = media.findSummary(id).orElseThrow(() -> new ResourceNotFoundException("No image with id " + id + "."));
        List<String> usages = whereUsed(asset.url());
        if (!usages.isEmpty()) {
            throw new ConflictException("MEDIA_IN_USE", "This image is still used on the site. Replace it there first.",
                    usages.stream().map(u -> new FieldProblem("usage", u)).toList());
        }
        media.deleteById(id);
        audit.record(admin, "MEDIA_DELETED", "media", id, "Deleted " + asset.fileName());
    }

    @Transactional(readOnly = true)
    public List<String> whereUsedById(Long id) {
        return whereUsed(media.findSummary(id).orElseThrow(() -> new ResourceNotFoundException("No image with id " + id + ".")).url());
    }

    @Transactional(readOnly = true)
    public List<String> whereUsed(String url) {
        return usageSources.stream().flatMap(s -> s.usagesOf(url).stream()).distinct().toList();
    }

    @Transactional(readOnly = true)
    public Optional<MediaRepository.MediaFile> file(String key) {
        return media.findFile(key);
    }

    /** True if the URL points at an image that exists in the library (used to validate references). */
    @Transactional(readOnly = true)
    public boolean exists(String mediaUrl) {
        if (mediaUrl == null || !mediaUrl.startsWith("/media/")) {
            return false;
        }
        String name = mediaUrl.substring("/media/".length());
        int dot = name.lastIndexOf('.');
        return dot > 0 && media.findFile(name.substring(0, dot)).map(f -> f.extension().equals(name.substring(dot + 1))).orElse(false);
    }

    private String newKey() {
        StringBuilder sb = new StringBuilder(20);
        for (int i = 0; i < 20; i++) {
            sb.append(KEY_ALPHABET[random.nextInt(KEY_ALPHABET.length)]);
        }
        return sb.toString();
    }

    /** Keeps letters, digits, dashes and dots; never trusts the uploaded name for anything else. */
    static String safeFileName(String original, String extension) {
        String base = original == null ? "" : original.replaceAll("\\.[A-Za-z0-9]{1,5}$", "");
        base = base.toLowerCase(Locale.ROOT).replaceAll("[^a-z0-9]+", "-").replaceAll("(^-+|-+$)", "");
        if (base.isEmpty()) {
            base = "image";
        }
        if (base.length() > 120) {
            base = base.substring(0, 120);
        }
        return base + "." + extension;
    }

    private static String clean(String value, int max) {
        String v = value == null ? "" : value.strip();
        return v.length() > max ? v.substring(0, max) : v;
    }

    private static String sha256(byte[] bytes) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(bytes));
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }
}
