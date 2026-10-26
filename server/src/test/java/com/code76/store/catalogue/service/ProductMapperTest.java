package com.code76.store.catalogue.service;

import com.code76.store.catalogue.domain.Category;
import com.code76.store.catalogue.domain.Fit;
import com.code76.store.catalogue.domain.Product;
import com.code76.store.catalogue.domain.ProductColor;
import com.code76.store.catalogue.domain.Size;
import com.code76.store.catalogue.dto.CatalogueDtos.ColorwayDto;
import com.code76.store.catalogue.dto.CatalogueDtos.ProductSummaryDto;
import com.code76.store.catalogue.dto.CatalogueDtos.SizeOptionDto;
import org.junit.jupiter.api.Test;

import java.time.Instant;

import static org.assertj.core.api.Assertions.assertThat;

class ProductMapperTest {

    private final ProductMapper mapper = new ProductMapper();
    private final Category category = new Category("essentials", "Essentials", null, 1);

    @Test
    void mapsPriceInPaiseAndLowercaseFit() {
        ProductSummaryDto dto = mapper.toSummary(product(249000));

        assertThat(dto.price().amountPaise()).isEqualTo(249000);
        assertThat(dto.price().currency()).isEqualTo("INR");
        assertThat(dto.fit()).isEqualTo("oversized");
        assertThat(dto.category().slug()).isEqualTo("essentials");
    }

    @Test
    void exposesCompareAtPriceOnlyWhenHigherThanPrice() {
        Product offer = product(169000);
        offer.setCompareAtPricePaise(199000L);
        Product noOffer = product(169000);
        noOffer.setCompareAtPricePaise(169000L);

        assertThat(mapper.toSummary(offer).compareAtPrice().amountPaise()).isEqualTo(199000);
        assertThat(mapper.toSummary(noOffer).compareAtPrice()).isNull();
    }

    @Test
    void hidesInactiveVariantsAndColourwaysWithoutActiveSizes() {
        Product p = product(249000);
        ProductColor noir = p.addColor("noir", "Noir", "#111111");
        noir.addImage("/images/products/form-noir-1.webp", "Noir front");
        ProductColor bone = p.addColor("bone", "Bone", "#EEE9E0");
        p.addVariant(noir, Size.S, "SKU-NOIR-S", 4);
        p.addVariant(noir, Size.M, "SKU-NOIR-M", 0);
        p.addVariant(noir, Size.L, "SKU-NOIR-L", 3).setActive(false);
        p.addVariant(bone, Size.M, "SKU-BONE-M", 2).setActive(false);

        ProductSummaryDto dto = mapper.toSummary(p);

        assertThat(dto.sizes()).containsExactly("S", "M");
        assertThat(dto.colorways()).extracting(ColorwayDto::code).containsExactly("noir");
        assertThat(dto.colorways().getFirst().sizes()).containsExactly(
                new SizeOptionDto("S", "SKU-NOIR-S", true),
                new SizeOptionDto("M", "SKU-NOIR-M", false));
        assertThat(dto.colorways().getFirst().images().getFirst().url()).isEqualTo("/images/products/form-noir-1.webp");
    }

    @Test
    void ordersSizesBySizeNotInsertion() {
        Product p = product(100000);
        ProductColor c = p.addColor("ink", "Ink", "#000000");
        p.addVariant(c, Size.XL, "A-XL", 1);
        p.addVariant(c, Size.XS, "A-XS", 1);
        p.addVariant(c, Size.M, "A-M", 1);

        assertThat(mapper.toSummary(p).sizes()).containsExactly("XS", "M", "XL");
    }

    private Product product(long pricePaise) {
        Product p = new Product("form-oversized-tee", "Form Oversized Tee", category, Fit.OVERSIZED, "Oversized fit", pricePaise);
        p.publish(Instant.parse("2026-09-01T00:00:00Z"));
        return p;
    }
}
