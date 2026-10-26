package com.code76.store.admin.catalogue;

import com.code76.store.accounts.security.AccountPrincipal;
import com.code76.store.admin.ImageUrls;
import com.code76.store.admin.audit.AdminAuditService;
import com.code76.store.admin.catalogue.AdminCatalogueDtos.CategoryRequest;
import com.code76.store.admin.catalogue.AdminCatalogueDtos.CategoryRow;
import com.code76.store.admin.catalogue.AdminCatalogueDtos.CollectionRequest;
import com.code76.store.admin.catalogue.AdminCatalogueDtos.CollectionRow;
import com.code76.store.admin.catalogue.AdminCatalogueDtos.ColorDetail;
import com.code76.store.admin.catalogue.AdminCatalogueDtos.ColorRequest;
import com.code76.store.admin.catalogue.AdminCatalogueDtos.ColorUpdateRequest;
import com.code76.store.admin.catalogue.AdminCatalogueDtos.ImageRef;
import com.code76.store.admin.catalogue.AdminCatalogueDtos.ProductDetail;
import com.code76.store.admin.catalogue.AdminCatalogueDtos.ProductRequest;
import com.code76.store.admin.catalogue.AdminCatalogueDtos.ProductRow;
import com.code76.store.admin.catalogue.AdminCatalogueDtos.SizeRow;
import com.code76.store.admin.catalogue.AdminCatalogueDtos.SizeUpdate;
import com.code76.store.catalogue.domain.Category;
import com.code76.store.catalogue.domain.CuratedCollection;
import com.code76.store.catalogue.domain.Fit;
import com.code76.store.catalogue.domain.Product;
import com.code76.store.catalogue.domain.ProductColor;
import com.code76.store.catalogue.domain.ProductStatus;
import com.code76.store.catalogue.domain.ProductVariant;
import com.code76.store.catalogue.domain.Size;
import com.code76.store.catalogue.dto.CatalogueDtos.Money;
import com.code76.store.catalogue.repository.CategoryRepository;
import com.code76.store.catalogue.repository.CollectionRepository;
import com.code76.store.catalogue.repository.ProductRepository;
import com.code76.store.catalogue.repository.ProductVariantRepository;
import com.code76.store.common.error.ApiError.FieldProblem;
import com.code76.store.common.error.ConflictException;
import com.code76.store.common.error.InvalidRequestException;
import com.code76.store.common.error.ResourceNotFoundException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * Everything the admin can change about the catalogue. Rules that protect customers and past orders:
 * a product can only go live when it's complete; stock can't drop below what's held for unpaid orders;
 * anything that has been ordered is archived, never deleted.
 */
@Service
@Transactional
public class AdminCatalogueService {

    private final ProductRepository products;
    private final ProductVariantRepository variants;
    private final CategoryRepository categories;
    private final CollectionRepository collections;
    private final ImageUrls images;
    private final AdminAuditService audit;
    private final JdbcTemplate jdbc;
    private final Clock clock;

    public AdminCatalogueService(ProductRepository products, ProductVariantRepository variants, CategoryRepository categories,
                                 CollectionRepository collections, ImageUrls images, AdminAuditService audit, JdbcTemplate jdbc, Clock clock) {
        this.products = products;
        this.variants = variants;
        this.categories = categories;
        this.collections = collections;
        this.images = images;
        this.audit = audit;
        this.jdbc = jdbc;
        this.clock = clock;
    }

    // ================= products =================

    @Transactional(readOnly = true)
    public List<ProductRow> listProducts(String query, String status) {
        String q = query == null ? "" : query.trim().toLowerCase(Locale.ROOT);
        return products.findAllByOrderByFeaturedRankAscIdAsc().stream()
                .filter(p -> status == null || status.isBlank() || p.getStatus().name().equalsIgnoreCase(status))
                .filter(p -> q.isEmpty() || p.getName().toLowerCase(Locale.ROOT).contains(q) || p.getSlug().contains(q))
                .map(this::toRow)
                .toList();
    }

    @Transactional(readOnly = true)
    public ProductDetail getProduct(String idOrSlug) {
        return toDetail(find(idOrSlug));
    }

    public ProductDetail createProduct(ProductRequest r, AccountPrincipal admin) {
        String slug = uniqueSlug(r.slug() == null || r.slug().isBlank() ? slugify(r.name()) : r.slug(), null);
        Product p = new Product(slug, r.name().trim(), category(r.categorySlug()), fit(r.fit()), r.fitLabel().trim(), r.pricePaise());
        applyFields(p, r);
        p.setFeaturedRank(products.maxFeaturedRank() + 10); // new products go to the end of the list
        products.saveAndFlush(p);
        audit.record(admin, "PRODUCT_CREATED", "product", p.getId(), "Created product " + p.getName() + " (draft)");
        return toDetail(p);
    }

    public ProductDetail updateProduct(Long id, ProductRequest r, AccountPrincipal admin) {
        Product p = byId(id);
        String wantedSlug = r.slug() == null || r.slug().isBlank() ? p.getSlug() : r.slug();
        if (!wantedSlug.equals(p.getSlug())) {
            if (products.existsBySlug(wantedSlug)) {
                throw new InvalidRequestException("slug", "is already used by another product");
            }
            p.setSlug(wantedSlug);
        }
        p.setName(r.name().trim());
        p.setCategory(category(r.categorySlug()));
        p.setFit(fit(r.fit()));
        p.setFitLabel(r.fitLabel().trim());
        p.setPricePaise(r.pricePaise());
        applyFields(p, r);
        audit.record(admin, "PRODUCT_UPDATED", "product", id, "Edited product " + p.getName());
        return toDetail(products.saveAndFlush(p));
    }

    public ProductDetail setStatus(Long id, String status, AccountPrincipal admin) {
        Product p = byId(id);
        ProductStatus target = ProductStatus.valueOf(status.toUpperCase(Locale.ROOT));
        if (target == ProductStatus.PUBLISHED) {
            List<FieldProblem> missing = readinessProblems(p);
            if (!missing.isEmpty()) {
                throw new ConflictException("NOT_READY_TO_PUBLISH", "This product isn't ready to go live yet.", missing);
            }
            p.publish(clock.instant());
        } else {
            p.unpublish(target);
        }
        audit.record(admin, "PRODUCT_" + target.name(), "product", id, switch (target) {
            case PUBLISHED -> "Published " + p.getName();
            case DRAFT -> "Moved " + p.getName() + " back to drafts";
            case ARCHIVED -> "Archived " + p.getName();
        });
        return toDetail(products.saveAndFlush(p));
    }

    /** Only products that were never ordered can be deleted; the rest are archived to keep order history intact. */
    public void deleteProduct(Long id, AccountPrincipal admin) {
        Product p = byId(id);
        if (hasOrders(p.getId())) {
            throw new ConflictException("HAS_ORDERS", "This product has been ordered, so it can't be deleted. Archive it instead.");
        }
        if (p.getVariants().stream().anyMatch(v -> v.getInventory().getQuantityReserved() > 0)) {
            throw new ConflictException("STOCK_HELD", "Some of this product is held for an unpaid order. Try again once it's paid or expired.");
        }
        // Sizes first: they point at colours, so removing colours first would leave them pointing at nothing.
        p.getVariants().clear();
        products.flush();
        products.delete(p);
        audit.record(admin, "PRODUCT_DELETED", "product", id, "Deleted product " + p.getName());
    }

    /** "Which T-shirts show first": the list order becomes the shop's Featured order. */
    public List<ProductRow> reorderProducts(List<Long> ids, AccountPrincipal admin) {
        Map<Long, Product> byId = products.findAllById(ids).stream().collect(Collectors.toMap(Product::getId, Function.identity()));
        if (byId.size() != new HashSet<>(ids).size()) {
            throw new InvalidRequestException("ids", "contains a product that doesn't exist");
        }
        for (int i = 0; i < ids.size(); i++) {
            byId.get(ids.get(i)).setFeaturedRank((i + 1) * 10);
        }
        products.flush();
        audit.record(admin, "PRODUCTS_REORDERED", "product", null, "Changed the display order of " + ids.size() + " products");
        return listProducts(null, null);
    }

    // ---- colours ----

    public ProductDetail addColor(Long id, ColorRequest r, AccountPrincipal admin) {
        Product p = byId(id);
        Set<String> taken = p.getColors().stream().map(ProductColor::getCode).collect(Collectors.toSet());
        String base = slugify(r.name());
        String code = base;
        for (int n = 2; taken.contains(code); n++) {
            code = base + "-" + n;
        }
        p.addColor(code, r.name().trim(), r.hex().toUpperCase(Locale.ROOT));
        audit.record(admin, "COLOR_ADDED", "product", id, "Added colour " + r.name().trim() + " to " + p.getName());
        return toDetail(products.saveAndFlush(p));
    }

    public ProductDetail updateColor(Long id, Long colorId, ColorUpdateRequest r, AccountPrincipal admin) {
        Product p = byId(id);
        ProductColor c = color(p, colorId);
        List<String[]> photos = new ArrayList<>();
        for (int i = 0; i < r.images().size(); i++) {
            ImageRef img = r.images().get(i);
            photos.add(new String[] {images.require(img.url().trim(), "images[" + i + "].url"), img.alt() == null ? "" : img.alt().trim()});
        }
        c.setName(r.name().trim());
        c.setHex(r.hex().toUpperCase(Locale.ROOT));
        c.replaceImages(photos);
        audit.record(admin, "COLOR_UPDATED", "product", id, "Edited colour " + c.getName() + " of " + p.getName() + " (" + photos.size() + " photos)");
        return toDetail(products.saveAndFlush(p));
    }

    public ProductDetail reorderColors(Long id, List<Long> colorIds, AccountPrincipal admin) {
        Product p = byId(id);
        if (colorIds.size() != p.getColors().size() || !new HashSet<>(colorIds).equals(p.getColors().stream().map(ProductColor::getId).collect(Collectors.toSet()))) {
            throw new InvalidRequestException("ids", "must list every colour of this product exactly once");
        }
        for (int i = 0; i < colorIds.size(); i++) {
            color(p, colorIds.get(i)).setSortOrder(i);
        }
        audit.record(admin, "COLORS_REORDERED", "product", id, "Changed the colour order of " + p.getName());
        products.saveAndFlush(p);
        return toDetail(byId(id));
    }

    public ProductDetail deleteColor(Long id, Long colorId, AccountPrincipal admin) {
        Product p = byId(id);
        ProductColor c = color(p, colorId);
        boolean held = p.getVariants().stream().anyMatch(v -> v.getColor() == c && v.getInventory().getQuantityReserved() > 0);
        if (held) {
            throw new ConflictException("STOCK_HELD", "Some of this colour is held for an unpaid order. Try again once it's paid or expired.");
        }
        p.removeColor(c);
        if (p.isPublished() && !readinessProblems(p).isEmpty()) {
            throw new ConflictException("WOULD_HIDE_PRODUCT", "This is the last colour on sale. Move the product to drafts before removing it.");
        }
        audit.record(admin, "COLOR_DELETED", "product", id, "Removed colour " + c.getName() + " from " + p.getName());
        return toDetail(products.saveAndFlush(p));
    }

    // ---- sizes and stock ----

    /**
     * Which sizes a colour comes in, how many of each are on the shelf, and an optional price for that size.
     * A size that's switched off stays in the records (orders may point at it); it just isn't sold.
     */
    public ProductDetail setSizes(Long id, Long colorId, List<SizeUpdate> rows, AccountPrincipal admin) {
        Product p = byId(id);
        ProductColor c = color(p, colorId);
        List<FieldProblem> problems = new ArrayList<>();
        for (SizeUpdate row : rows) {
            Size size = Size.valueOf(row.size());
            ProductVariant existing = p.getVariants().stream().filter(v -> v.getColor() == c && v.getSize() == size).findFirst().orElse(null);
            if (existing != null) {
                int reserved = existing.getInventory().getQuantityReserved();
                if (row.stock() < reserved) {
                    problems.add(new FieldProblem(row.size(), reserved + " are held for unpaid orders, so stock can't go below " + reserved + "."));
                    continue;
                }
                existing.setActive(row.active());
                existing.getInventory().setQuantityOnHand(row.stock());
                existing.setPricePaise(row.pricePaise());
            } else if (row.active() || row.stock() > 0) {
                ProductVariant v = p.addVariant(c, size, uniqueSku(p, c, size), row.stock());
                v.setActive(row.active());
                v.setPricePaise(row.pricePaise());
            }
        }
        if (!problems.isEmpty()) {
            throw new ConflictException("STOCK_HELD", "Some sizes couldn't be changed.", problems);
        }
        audit.record(admin, "SIZES_UPDATED", "product", id, "Updated sizes and stock of " + p.getName() + " in " + c.getName());
        return toDetail(products.saveAndFlush(p));
    }

    // ================= categories =================

    @Transactional(readOnly = true)
    public List<CategoryRow> listCategories() {
        Map<Long, Long> counts = countsBy("select category_id, count(*) from products group by category_id");
        return categories.findAllByOrderBySortOrderAscNameAsc().stream()
                .map(c -> new CategoryRow(c.getId(), c.getSlug(), c.getName(), c.getDescription(), c.getSortOrder(), counts.getOrDefault(c.getId(), 0L)))
                .toList();
    }

    public CategoryRow saveCategory(Long id, CategoryRequest r, AccountPrincipal admin) {
        categories.findBySlug(r.slug()).filter(other -> !other.getId().equals(id)).ifPresent(other -> {
            throw new InvalidRequestException("slug", "is already used by another category");
        });
        Category c = id == null ? new Category(r.slug(), r.name().trim(), blankToNull(r.description()), r.sortOrder()) : category(id);
        c.update(r.slug(), r.name().trim(), blankToNull(r.description()), r.sortOrder());
        categories.saveAndFlush(c);
        audit.record(admin, id == null ? "CATEGORY_CREATED" : "CATEGORY_UPDATED", "category", c.getId(), (id == null ? "Created" : "Edited") + " category " + c.getName());
        return listCategories().stream().filter(x -> x.id().equals(c.getId())).findFirst().orElseThrow();
    }

    public void deleteCategory(Long id, AccountPrincipal admin) {
        Category c = category(id);
        Long used = jdbc.queryForObject("select count(*) from products where category_id = ?", Long.class, id);
        if (used != null && used > 0) {
            throw new ConflictException("CATEGORY_IN_USE", "Move its " + used + " product(s) to another category first.");
        }
        categories.delete(c);
        audit.record(admin, "CATEGORY_DELETED", "category", id, "Deleted category " + c.getName());
    }

    // ================= collections =================

    @Transactional(readOnly = true)
    public List<CollectionRow> listCollections() {
        Map<Long, Long> counts = countsBy("select collection_id, count(*) from product_collections group by collection_id");
        return collections.findAllByOrderBySortOrderAscNameAsc().stream().map(c -> toRow(c, counts)).toList();
    }

    public CollectionRow saveCollection(Long id, CollectionRequest r, AccountPrincipal admin) {
        collections.findBySlug(r.slug()).filter(other -> !other.getId().equals(id)).ifPresent(other -> {
            throw new InvalidRequestException("slug", "is already used by another collection");
        });
        String banner = images.optional(r.bannerUrl(), "bannerUrl");
        CuratedCollection c = id == null ? new CuratedCollection(r.slug(), r.name().trim(), blankToNull(r.description()), r.sortOrder()) : collection(id);
        c.update(r.slug(), r.name().trim(), blankToNull(r.description()), r.sortOrder(), r.active(),
                trim(r.eyebrow()), trim(r.intro()), banner, trim(r.bannerAlt()));
        collections.saveAndFlush(c);
        audit.record(admin, id == null ? "COLLECTION_CREATED" : "COLLECTION_UPDATED", "collection", c.getId(), (id == null ? "Created" : "Edited") + " collection " + c.getName());
        return toRow(c, countsBy("select collection_id, count(*) from product_collections group by collection_id"));
    }

    public void deleteCollection(Long id, AccountPrincipal admin) {
        CuratedCollection c = collection(id);
        jdbc.update("delete from product_collections where collection_id = ?", id);
        collections.delete(c);
        audit.record(admin, "COLLECTION_DELETED", "collection", id, "Deleted collection " + c.getName() + " (its products were kept)");
    }

    // ================= helpers =================

    private void applyFields(Product p, ProductRequest r) {
        if (r.compareAtPricePaise() != null && r.compareAtPricePaise() <= r.pricePaise()) {
            throw new InvalidRequestException("compareAtPricePaise", "must be higher than the price (it's the “was” price)");
        }
        p.setSubtitle(blankToNull(r.subtitle()));
        p.setDescription(blankToNull(r.description()));
        p.setCompareAtPricePaise(r.compareAtPricePaise());
        p.setNewArrival(r.newArrival());
        p.setDetails(lines(r.details()));
        p.setFitNotes(lines(r.fitNotes()));
        p.setCareInstructions(lines(r.care()));
        Set<CuratedCollection> chosen = new HashSet<>();
        for (String slug : r.collections() == null ? List.<String>of() : r.collections()) {
            chosen.add(collections.findBySlug(slug).orElseThrow(() -> new InvalidRequestException("collections", "has an unknown collection: " + slug)));
        }
        p.getCollections().retainAll(chosen);
        p.getCollections().addAll(chosen);
    }

    /** What's still missing before a product can go on sale (empty when it's ready). */
    private List<FieldProblem> readinessProblems(Product p) {
        List<FieldProblem> problems = new ArrayList<>();
        boolean anyColourReady = p.getColors().stream().anyMatch(c -> !c.getImages().isEmpty()
                && p.getVariants().stream().anyMatch(v -> v.getColor() == c && v.isActive()));
        if (p.getColors().isEmpty()) {
            problems.add(new FieldProblem("colors", "Add at least one colour."));
        } else if (!anyColourReady) {
            problems.add(new FieldProblem("colors", "At least one colour needs a photo and at least one size switched on."));
        }
        if (p.getPricePaise() <= 0) {
            problems.add(new FieldProblem("pricePaise", "Set a price."));
        }
        return problems;
    }

    private ProductRow toRow(Product p) {
        List<ProductVariant> active = p.getVariants().stream().filter(ProductVariant::isActive).toList();
        String thumb = p.getColors().stream().sorted(Comparator.comparingInt(ProductColor::getSortOrder))
                .flatMap(c -> c.getImages().stream()).map(i -> i.getUrl()).findFirst().orElse(null);
        List<String> sizes = active.stream().map(ProductVariant::getSize).distinct().sorted().map(Enum::name).toList();
        int stock = active.stream().mapToInt(v -> v.getInventory().available()).sum();
        boolean live = p.isPublished() && p.getPublishedAt() != null && readinessProblems(p).isEmpty();
        return new ProductRow(p.getId(), p.getSlug(), p.getName(), p.getStatus().name().toLowerCase(Locale.ROOT), p.getFit().apiValue(),
                p.getCategory().getName(), Money.inr(p.getPricePaise()), p.getCompareAtPricePaise() == null ? null : Money.inr(p.getCompareAtPricePaise()),
                p.isNewArrival(), p.getFeaturedRank(), thumb, p.getColors().size(), sizes, stock, live);
    }

    private ProductDetail toDetail(Product p) {
        List<ColorDetail> colors = p.getColors().stream()
                .sorted(Comparator.comparingInt(ProductColor::getSortOrder))
                .map(c -> new ColorDetail(c.getId(), c.getCode(), c.getName(), c.getHex(), c.getSortOrder(),
                        c.getImages().stream().map(i -> new ImageRef(i.getUrl(), i.getAltText())).toList(),
                        p.getVariants().stream().filter(v -> v.getColor() == c || Objects.equals(v.getColor().getId(), c.getId()))
                                .sorted(Comparator.comparing(ProductVariant::getSize))
                                .map(v -> new SizeRow(v.getId(), v.getSize().name(), v.getSku(), v.isActive(), v.getInventory().getQuantityOnHand(),
                                        v.getInventory().getQuantityReserved(), v.getInventory().available(), v.getPricePaise()))
                                .toList()))
                .toList();
        return new ProductDetail(p.getId(), p.getSlug(), p.getName(), p.getSubtitle(), p.getDescription(), p.getStatus().name().toLowerCase(Locale.ROOT),
                p.getFit().apiValue(), p.getFitLabel(), p.getCategory().getSlug(),
                p.getCollections().stream().map(CuratedCollection::getSlug).sorted().toList(),
                Money.inr(p.getPricePaise()), p.getCompareAtPricePaise() == null ? null : Money.inr(p.getCompareAtPricePaise()),
                p.isNewArrival(), p.getFeaturedRank(), List.copyOf(p.getDetails()), List.copyOf(p.getFitNotes()), List.copyOf(p.getCareInstructions()),
                p.getPublishedAt(), colors, p.getId() != null && hasOrders(p.getId()));
    }

    private CollectionRow toRow(CuratedCollection c, Map<Long, Long> counts) {
        return new CollectionRow(c.getId(), c.getSlug(), c.getName(), c.getDescription(), c.getSortOrder(), c.isActive(),
                c.getEyebrow(), c.getIntro(), c.getBannerUrl(), c.getBannerAlt(), counts.getOrDefault(c.getId(), 0L));
    }

    private boolean hasOrders(Long productId) {
        Long n = jdbc.queryForObject("""
                select count(*) from order_items oi join product_variants v on v.id = oi.variant_id where v.product_id = ?""", Long.class, productId);
        return n != null && n > 0;
    }

    private Map<Long, Long> countsBy(String sql) {
        return jdbc.query(sql, rs -> {
            Map<Long, Long> m = new java.util.HashMap<>();
            while (rs.next()) {
                m.put(rs.getLong(1), rs.getLong(2));
            }
            return m;
        });
    }

    private Product find(String idOrSlug) {
        if (idOrSlug.chars().allMatch(Character::isDigit)) {
            return byId(Long.parseLong(idOrSlug));
        }
        return products.findBySlug(idOrSlug).orElseThrow(() -> new ResourceNotFoundException("No product found for '" + idOrSlug + "'."));
    }

    private Product byId(Long id) {
        return products.findById(id).orElseThrow(() -> new ResourceNotFoundException("No product with id " + id + "."));
    }

    private static ProductColor color(Product p, Long colorId) {
        return p.getColors().stream().filter(c -> c.getId().equals(colorId)).findFirst()
                .orElseThrow(() -> new ResourceNotFoundException("That colour isn't part of this product."));
    }

    private Category category(String slug) {
        return categories.findBySlug(slug).orElseThrow(() -> new InvalidRequestException("categorySlug", "is not a category"));
    }

    private Category category(Long id) {
        return categories.findById(id).orElseThrow(() -> new ResourceNotFoundException("No category with id " + id + "."));
    }

    private CuratedCollection collection(Long id) {
        return collections.findById(id).orElseThrow(() -> new ResourceNotFoundException("No collection with id " + id + "."));
    }

    private static Fit fit(String apiValue) {
        return Fit.fromApiValue(apiValue).orElseThrow(() -> new InvalidRequestException("fit", "must be oversized or regular"));
    }

    private String uniqueSlug(String wanted, Long ignoreId) {
        String base = slugify(wanted);
        String slug = base;
        for (int n = 2; products.findBySlug(slug).filter(p -> !p.getId().equals(ignoreId)).isPresent(); n++) {
            slug = base + "-" + n;
        }
        return slug;
    }

    /** SKUs like C76-FORM-NOIR-M, made unique if needed. */
    private String uniqueSku(Product p, ProductColor c, Size size) {
        String word = p.getSlug().split("-")[0].toUpperCase(Locale.ROOT);
        String base = ("C76-" + word + "-" + c.getCode().toUpperCase(Locale.ROOT) + "-" + size.name()).replaceAll("[^A-Z0-9-]", "");
        if (base.length() > 60) {
            base = base.substring(0, 60);
        }
        Set<String> local = p.getVariants().stream().map(ProductVariant::getSku).collect(Collectors.toSet());
        String sku = base;
        for (int n = 2; local.contains(sku) || variants.findBySku(sku).isPresent(); n++) {
            sku = base + "-" + n;
        }
        return sku;
    }

    static String slugify(String text) {
        String s = text == null ? "" : java.text.Normalizer.normalize(text, java.text.Normalizer.Form.NFKD)
                .replaceAll("\\p{M}", "").toLowerCase(Locale.ROOT).replaceAll("[^a-z0-9]+", "-").replaceAll("(^-+|-+$)", "");
        if (s.isEmpty()) {
            s = "item";
        }
        return s.length() > 100 ? s.substring(0, 100).replaceAll("-+$", "") : s;
    }

    private static List<String> lines(List<String> raw) {
        return raw == null ? List.of() : raw.stream().map(String::trim).filter(l -> !l.isEmpty()).toList();
    }

    private static String blankToNull(String v) {
        return v == null || v.isBlank() ? null : v.trim();
    }

    private static String trim(String v) {
        return v == null ? "" : v.trim();
    }
}
