package com.code76.store.admin.api;

import com.code76.store.accounts.security.AccountPrincipal;
import com.code76.store.catalogue.dto.CatalogueDtos.PageResponse;
import com.code76.store.media.MediaService;
import com.code76.store.media.MediaService.MediaDto;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Size;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.List;

/** The media library (admins only, see SecurityConfig). */
@RestController
@Validated
@RequestMapping("/api/admin/media")
public class AdminMediaController {

    public record UpdateMediaRequest(@Size(max = 300, message = "must be at most 300 characters") String altText) {
    }

    private final MediaService media;

    public AdminMediaController(MediaService media) {
        this.media = media;
    }

    @GetMapping
    public PageResponse<MediaDto> list(@RequestParam(defaultValue = "") @Size(max = 100) String q,
                                       @RequestParam(defaultValue = "0") @Min(0) int page,
                                       @RequestParam(defaultValue = "40") @Min(1) @Max(100) int pageSize) {
        return media.list(q, page, pageSize);
    }

    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<MediaDto> upload(@AuthenticationPrincipal AccountPrincipal admin,
                                           @RequestPart("file") MultipartFile file,
                                           @RequestParam(value = "altText", defaultValue = "") String altText) throws IOException {
        return ResponseEntity.status(HttpStatus.CREATED).body(media.upload(file.getBytes(), file.getOriginalFilename(), altText, admin));
    }

    @PatchMapping("/{id}")
    public MediaDto update(@AuthenticationPrincipal AccountPrincipal admin, @PathVariable long id, @Valid @RequestBody UpdateMediaRequest body) {
        return media.updateAltText(id, body.altText(), admin);
    }

    /** Where an image is used, so the library can show it before anyone tries to delete it. */
    @GetMapping("/{id}/usages")
    public List<String> usages(@PathVariable long id) {
        return media.whereUsedById(id);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@AuthenticationPrincipal AccountPrincipal admin, @PathVariable long id) {
        media.delete(id, admin);
        return ResponseEntity.noContent().build();
    }
}
