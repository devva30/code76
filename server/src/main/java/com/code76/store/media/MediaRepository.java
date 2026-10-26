package com.code76.store.media;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.Optional;

public interface MediaRepository extends JpaRepository<MediaAsset, Long> {

    /** Library listing without the (large) image bytes. */
    record MediaSummary(Long id, String publicKey, String extension, String fileName, String contentType, int sizeBytes,
                        int width, int height, String altText, Instant createdAt) {
        public String url() {
            return "/media/" + publicKey + "." + extension;
        }
    }

    /** Just what's needed to send the file to a browser. */
    record MediaFile(byte[] bytes, String contentType, String extension, String sha256) {
    }

    @Query("""
            select new com.code76.store.media.MediaRepository$MediaSummary(m.id, m.publicKey, m.extension, m.fileName, m.contentType,
                   m.sizeBytes, m.width, m.height, m.altText, m.createdAt)
            from MediaAsset m
            where :q = '' or lower(m.fileName) like :pattern escape '\\' or lower(m.altText) like :pattern escape '\\'
            order by m.createdAt desc, m.id desc""")
    Page<MediaSummary> search(@Param("q") String q, @Param("pattern") String pattern, Pageable pageable);

    @Query("""
            select new com.code76.store.media.MediaRepository$MediaSummary(m.id, m.publicKey, m.extension, m.fileName, m.contentType,
                   m.sizeBytes, m.width, m.height, m.altText, m.createdAt)
            from MediaAsset m where m.id = :id""")
    Optional<MediaSummary> findSummary(@Param("id") Long id);

    @Query("""
            select new com.code76.store.media.MediaRepository$MediaSummary(m.id, m.publicKey, m.extension, m.fileName, m.contentType,
                   m.sizeBytes, m.width, m.height, m.altText, m.createdAt)
            from MediaAsset m where m.sha256 = :sha256""")
    Optional<MediaSummary> findSummaryBySha256(@Param("sha256") String sha256);

    @Query("select new com.code76.store.media.MediaRepository$MediaFile(m.bytes, m.contentType, m.extension, m.sha256) from MediaAsset m where m.publicKey = :key")
    Optional<MediaFile> findFile(@Param("key") String key);
}
