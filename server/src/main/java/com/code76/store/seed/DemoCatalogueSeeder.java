package com.code76.store.seed;

import com.code76.store.catalogue.domain.Category;
import com.code76.store.catalogue.domain.CuratedCollection;
import com.code76.store.catalogue.domain.Fit;
import com.code76.store.catalogue.domain.Product;
import com.code76.store.catalogue.domain.ProductColor;
import com.code76.store.catalogue.domain.Size;
import com.code76.store.catalogue.repository.CategoryRepository;
import com.code76.store.catalogue.repository.CollectionRepository;
import com.code76.store.catalogue.repository.ProductRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.context.annotation.Profile;
import org.springframework.core.annotation.Order;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.json.JsonMapper;

import java.io.IOException;
import java.io.InputStream;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;
import java.util.Locale;

/**
 * Development-only demo catalogue, mirroring the frontend's product data
 * ({@code demo/catalogue.json}, exported from {@code src/data/products.ts}).
 * Active only with the {@code demo-data} profile (included in {@code dev}); never in production.
 * Idempotent: it does nothing if any product already exists.
 */
@Component
@Profile("demo-data")
@Order(1) // before website content is checked against the catalogue
public class DemoCatalogueSeeder implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(DemoCatalogueSeeder.class);
    private static final ZoneId STORE_ZONE = ZoneId.of("Asia/Kolkata");

    private final ProductRepository products;
    private final CategoryRepository categories;
    private final CollectionRepository collections;
    private final JsonMapper json;

    public DemoCatalogueSeeder(ProductRepository products, CategoryRepository categories,
                               CollectionRepository collections, JsonMapper json) {
        this.products = products;
        this.categories = categories;
        this.collections = collections;
        this.json = json;
    }

    // JSON shape of demo/catalogue.json
    record DemoImage(String src, String alt) {
    }

    record DemoColorway(String code, String name, String hex, List<String> soldOut, List<DemoImage> images) {
    }

    record DemoProduct(String slug, String name, String subtitle, long pricePaise, Long compareAtPricePaise,
                       String fit, String fitLabel, boolean isNew, int rank, String publishedOn, String description,
                       List<String> details, List<String> fitNotes, List<String> care, List<String> sizes,
                       List<DemoColorway> colorways) {
    }

    @Override
    @Transactional
    public void run(ApplicationArguments args) throws IOException {
        if (products.count() > 0) {
            log.info("Demo catalogue skipped: products already exist.");
            return;
        }

        Category essentials = categories.save(new Category("essentials", "Essential Tees",
                "Plain, considered T-shirts in oversized and regular fits.", 0));
        Category pocket = categories.save(new Category("pocket-tees", "Pocket Tees",
                "Everyday tees finished with a chest pocket.", 1));
        categories.save(new Category("graphic-tees", "Graphic Tees",
                "Printed and graphic T-shirts.", 2));

        CuratedCollection newArrivals = collections.save(new CuratedCollection("new-arrivals", "New Arrivals",
                "The latest additions for the new season.", 0));
        CuratedCollection oversized = collections.save(new CuratedCollection("oversized", "Oversized",
                "Dropped shoulders, wider bodies and a deliberate drape.", 1));
        CuratedCollection regular = collections.save(new CuratedCollection("regular-fit", "Regular Fit",
                "Clean, close lines with just enough ease.", 2));

        DemoProduct[] catalogue;
        try (InputStream in = new ClassPathResource("demo/catalogue.json").getInputStream()) {
            catalogue = json.readValue(in, DemoProduct[].class);
        }

        for (DemoProduct d : catalogue) {
            Category category = d.slug().contains("pocket") ? pocket : essentials;
            Fit fit = Fit.valueOf(d.fit());
            Product p = new Product(d.slug(), d.name(), category, fit, d.fitLabel(), d.pricePaise());
            p.setSubtitle(d.subtitle());
            p.setDescription(d.description());
            p.setCompareAtPricePaise(d.compareAtPricePaise());
            p.setNewArrival(d.isNew());
            p.setFeaturedRank(d.rank());
            p.setDetails(d.details());
            p.setFitNotes(d.fitNotes());
            p.setCareInstructions(d.care());
            p.publish(LocalDate.parse(d.publishedOn()).atStartOfDay(STORE_ZONE).toInstant());

            String skuStem = "C76-" + d.slug().split("-")[0].toUpperCase(Locale.ROOT);
            for (DemoColorway c : d.colorways()) {
                ProductColor color = p.addColor(c.code(), c.name(), c.hex());
                c.images().forEach(i -> color.addImage(i.src(), i.alt()));
                for (String sizeName : d.sizes()) {
                    Size size = Size.valueOf(sizeName);
                    String sku = skuStem + "-" + c.code().toUpperCase(Locale.ROOT) + "-" + size.name();
                    int stock = c.soldOut().contains(sizeName) ? 0 : demoStock(sku);
                    p.addVariant(color, size, sku, stock);
                }
            }

            if (d.isNew()) {
                p.getCollections().add(newArrivals);
            }
            p.getCollections().add(fit == Fit.OVERSIZED ? oversized : regular);
            products.save(p);
        }
        log.info("Demo catalogue seeded: {} products.", catalogue.length);
    }

    /** Deterministic demo stock between 8 and 38 units, so runs are reproducible. */
    static int demoStock(String sku) {
        return 8 + Math.floorMod(sku.hashCode(), 31);
    }
}
