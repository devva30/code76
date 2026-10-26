package com.code76.store.content;

import com.fasterxml.jackson.annotation.JsonInclude;

import java.util.Arrays;
import java.util.List;
import java.util.Optional;

/**
 * The one description of every editable part of the website. The server validates saves against it;
 * the admin panel builds its forms from it (GET /api/admin/content/schema). Add a field here and it
 * appears in the admin and is checked on save, with no other change needed.
 */
public final class ContentSchema {

    private ContentSchema() {
    }

    public record Option(String value, String label) {
    }

    /**
     * One field. Types: text, textarea, image, link, select, toggle, number, product, strings (list of
     * short texts), list (repeatable group of fields).
     */
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record Field(String key, String label, String type, boolean required, Integer max, String hint,
                        List<Option> options, Integer min, Integer maxItems, List<Field> fields, String itemLabel) {

        /** Must be filled in. */
        public Field mandatory() {
            return new Field(key, label, type, true, max, hint, options, min, maxItems, fields, itemLabel);
        }

        public Field hint(String text) {
            return new Field(key, label, type, required, max, text, options, min, maxItems, fields, itemLabel);
        }

        /** Which field names each list item by in the admin (e.g. a slide's headline). */
        public Field itemLabel(String fieldKey) {
            return new Field(key, label, type, required, max, hint, options, min, maxItems, fields, fieldKey);
        }
    }

    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record Section(String key, String label, String group, String description, String previewPath, List<Field> fields) {
    }

    // ---- field builders ----

    static Field text(String key, String label, int max) {
        return new Field(key, label, "text", false, max, null, null, null, null, null, null);
    }

    static Field textarea(String key, String label, int max) {
        return new Field(key, label, "textarea", false, max, null, null, null, null, null, null);
    }

    static Field image(String key, String label) {
        return new Field(key, label, "image", false, 500, null, null, null, null, null, null);
    }

    static Field link(String key, String label) {
        return new Field(key, label, "link", false, 300, "A page on this site (like /shop) or a full https:// address.", null, null, null, null, null);
    }

    static Field select(String key, String label, Option... options) {
        return new Field(key, label, "select", true, null, null, List.of(options), null, null, null, null);
    }

    static Field toggle(String key, String label) {
        return new Field(key, label, "toggle", false, null, null, null, null, null, null, null);
    }

    static Field number(String key, String label, int min, int max) {
        return new Field(key, label, "number", true, max, null, null, min, null, null, null);
    }

    static Field product(String key, String label) {
        return new Field(key, label, "product", false, 120, null, null, null, null, null, null);
    }

    static Field strings(String key, String label, int maxItems, int max) {
        return new Field(key, label, "strings", false, max, null, null, null, maxItems, null, null);
    }

    static Field list(String key, String label, int maxItems, Field... fields) {
        return new Field(key, label, "list", false, null, null, null, null, maxItems, List.of(fields), null);
    }

    static Option opt(String value, String label) {
        return new Option(value, label);
    }

    /** Two-line headline where the second line is shown in italics, used across the site. */
    static Field[] heading(String hint) {
        return new Field[] {
                text("line1", "Headline, first line", 60).mandatory(),
                text("line2", "Headline, second line (shown in italics)", 60).hint(hint),
        };
    }

    static Field[] concat(Field[]... groups) {
        return Arrays.stream(groups).flatMap(Arrays::stream).toArray(Field[]::new);
    }

    static Field[] of(Field... fields) {
        return fields;
    }

    private static Section section(String key, String label, String group, String description, String preview, Field... fields) {
        return new Section(key, label, group, description, preview, List.of(fields));
    }

    static final Option[] HOME_SECTIONS = {
            opt("hero", "Banner slideshow"), opt("ribbon", "Gold offers ribbon"), opt("featured", "New this season"), opt("offer", "Power-Up Deal (offer)"), opt("shopByFit", "Shop by fit"),
            opt("marquee", "Scrolling words"), opt("signature", "Signature piece"), opt("lookbook", "Lookbook"),
            opt("brandIntro", "Our approach"), opt("brandDetails", "The details"), opt("testimonials", "Impressions"),
            opt("newsletter", "Newsletter"),
    };

    static final Option[] SIZES = {
            opt("XXS", "XXS"), opt("XS", "XS"), opt("S", "S"), opt("M", "M"), opt("L", "L"), opt("XL", "XL"), opt("XXL", "XXL"), opt("XXXL", "3XL"),
    };

    // ---- every section of the site ----

    public static final List<Section> SECTIONS = List.of(
            // Home page
            section("home.layout", "Home page layout", "Home page", "Which sections appear on the home page, and in what order.", "/",
                    list("sections", "Sections, top to bottom", 12,
                            select("id", "Section", HOME_SECTIONS),
                            toggle("visible", "Show on the home page")).itemLabel("id")),
            section("home.hero", "Banner slideshow", "Home page", "The full-screen photos at the top of the home page. They change every 5 seconds.", "/",
                    list("slides", "Slides", 8,
                            image("image", "Photo for computers (landscape)").mandatory(),
                            select("fit", "How the photo fills the banner",
                                    opt("auto", "Automatic: tall photos are shown whole, wide photos fill the banner"),
                                    opt("cover", "Always fill the banner (edges may be cut off)"),
                                    opt("contain", "Always show the whole photo (dark sides if needed)")),
                            image("mobileImage", "Photo for phones (portrait)").mandatory(),
                            text("alt", "Describe the photo", 200).mandatory(),
                            text("eyebrowLeft", "Small label, left", 30),
                            text("eyebrowRight", "Small label, right", 40),
                            text("line1", "Headline, first line", 40).hint("Leave the headline, labels and paragraph empty to show only the button."),
                            text("line2", "Headline, second line", 40),
                            textarea("copy", "Short paragraph", 200),
                            text("ctaLabel", "Button text", 40).mandatory(),
                            link("ctaLink", "Button goes to").mandatory(),
                            text("pill", "Button text on phones (keep it short)", 30),
                            text("secondaryLabel", "Second link text (optional)", 40),
                            link("secondaryLink", "Second link goes to"),
                            select("tone", "Text colour", opt("ink", "Dark text (for light photos)"), opt("paper", "Light text (for dark photos)")),
                            select("align", "Text position", opt("left", "Left"), opt("right", "Right")),
                            select("vAlign", "Text height", opt("bottom", "Bottom"), opt("top", "Top")),
                            toggle("scrim", "Add a soft shade behind the text").hint("Helps light text stand out on busy photos."),
                            text("position", "Focus point on computers", 20).hint("Which part of the photo stays in view, e.g. 50% 40% (across, down)."),
                            text("mobilePosition", "Focus point on phones", 20)).itemLabel("line1")),
            section("home.ribbon", "Gold offers ribbon", "Home page", "The black strip with rolling gold offers, under the banner.", "/",
                    strings("items", "Messages", 8, 80).hint("One per line. {freeShipping} and {store} are filled in automatically."),
                    link("link", "Clicking the ribbon goes to")),
            section("home.featured", "New this season", "Home page", "The swipeable row of products under the banner. Order follows Products → Change display order.", "/",
                    concat(of(text("eyebrow", "Small label", 60)), heading(""), of(
                            textarea("copy", "Paragraph", 300),
                            text("linkLabel", "Link text", 40).hint("{count} shows how many pieces the store has, e.g. View all {count} pieces."),
                            link("linkTo", "Link goes to"),
                            number("count", "How many products to show", 3, 24)))),
            section("home.shopByFit", "Shop by fit", "Home page", "Two large photo panels leading to each fit.", "/",
                    concat(of(text("eyebrow", "Small label", 60)), heading(""), of(
                            textarea("intro", "Paragraph", 300),
                            list("cards", "Panels", 4,
                                    text("badge", "Badge on the photo", 20),
                                    text("title", "Title", 40).mandatory(),
                                    textarea("copy", "Paragraph", 300),
                                    text("ctaLabel", "Link text", 40),
                                    link("link", "Panel goes to").mandatory(),
                                    image("image", "Photo (portrait)").mandatory(),
                                    text("alt", "Describe the photo", 200)).itemLabel("title")))),
            section("home.marquee", "Scrolling words", "Home page", "The band of words that scrolls across the page.", "/",
                    strings("words", "Words", 12, 40)),
            section("home.signature", "Signature piece", "Home page", "A product story told in short chapters, with photos that change as you scroll.", "/",
                    concat(of(text("eyebrow", "Small label", 60)), heading(""), of(
                            product("productSlug", "Product").mandatory().hint("Shows its price and links to it."),
                            list("chapters", "Chapters", 5,
                                    text("label", "Photo label", 20),
                                    text("title", "Title", 60).mandatory(),
                                    textarea("body", "Paragraph", 400),
                                    image("image", "Photo").mandatory(),
                                    text("alt", "Describe the photo", 200)).itemLabel("title"),
                            text("ctaLabel", "Button text", 40)))),
            section("home.lookbook", "Lookbook", "Home page", "The dark band of photos that scrolls sideways.", "/",
                    concat(of(text("eyebrow", "Small label", 60)), heading(""), of(
                            textarea("intro", "Paragraph", 300),
                            list("frames", "Photos", 12,
                                    image("image", "Photo").mandatory(),
                                    text("alt", "Describe the photo", 200).mandatory(),
                                    text("caption", "Caption", 120),
                                    select("size", "Size", opt("tall", "Tall"), opt("wide", "Wide"), opt("small", "Small")),
                                    select("offset", "Height on the strip", opt("top", "Top"), opt("middle", "Middle"), opt("bottom", "Bottom")),
                                    product("productSlug", "Product shown (optional)")).itemLabel("caption"),
                            text("outroLine1", "Closing line", 60),
                            text("outroLine2", "Closing line, italics", 60),
                            text("ctaLabel", "Button text", 40),
                            link("ctaLink", "Button goes to")))),
            section("home.brandIntro", "Our approach", "Home page", "The big statement that lights up word by word.", "/",
                    concat(of(text("eyebrow", "Small label", 60)), heading(""), of(
                            textarea("statement", "Big statement", 400).mandatory(),
                            image("image", "Photo"),
                            text("alt", "Describe the photo", 200),
                            text("caption", "Photo caption", 120),
                            textarea("body", "Paragraph", 500),
                            text("linkLabel", "Link text", 40),
                            link("linkTo", "Link goes to")))),
            section("home.brandDetails", "The details", "Home page", "Four short points about how the tees are made, with two photos.", "/",
                    concat(of(text("eyebrow", "Small label", 60)), heading(""), of(
                            image("image1", "Large photo"), text("alt1", "Describe the large photo", 200),
                            image("image2", "Small photo"), text("alt2", "Describe the small photo", 200),
                            list("items", "Points", 8, text("title", "Title", 60).mandatory(), textarea("body", "Paragraph", 300)).itemLabel("title")))),
            section("home.testimonials", "Impressions", "Home page", "Customer quotes. Use real, verified reviews before launch.", "/",
                    concat(of(text("eyebrow", "Small label", 60)), heading(""), of(
                            toggle("showSampleNote", "Show the “sample content” stamp"),
                            text("sampleNote", "Stamp text", 80),
                            list("items", "Quotes", 6,
                                    textarea("quote", "Quote", 300).mandatory(),
                                    text("name", "Name", 60),
                                    text("detail", "Product or detail", 80)).itemLabel("name")))),
            section("home.offer", "Power-Up Deal (offer)", "Home page",
                    "A bold offer band on the home page. Only promise what the store really gives: free shipping (Store settings) or a “was” price on products. There are no coupon codes yet.", "/",
                    text("eyebrow", "Section name", 40).mandatory().hint("The catchy name, e.g. Power-Up Deal."),
                    text("badge", "Small tag", 24).hint("e.g. Limited arc. Leave empty to hide."),
                    text("line1", "Headline, first line", 50).mandatory(),
                    text("line2", "Headline, second line (gold, italic)", 50),
                    textarea("body", "Paragraph", 300).hint("{freeShipping} and {store} are filled in automatically."),
                    text("bigText", "Big badge word", 16).hint("Shown large inside the round badge, e.g. FREE or 15% OFF."),
                    text("bigNote", "Badge small print", 40).hint("e.g. shipping over {freeShipping}."),
                    strings("perks", "Perks (with a tick)", 4, 50),
                    text("ctaLabel", "Button text", 30).mandatory(),
                    link("ctaLink", "Button goes to").mandatory(),
                    text("endsOn", "Offer ends on (optional)", 10).hint("Date as YYYY-MM-DD, e.g. 2026-12-31. Shows a live countdown. Leave empty for no countdown."),
                    image("image", "Photo (optional)"),
                    text("alt", "Describe the photo", 200)),
            section("home.newsletter", "Newsletter", "Home page", "The sign-up section near the bottom of the home page.", "/",
                    concat(of(text("eyebrow", "Small label", 60)), heading(""), of(
                            textarea("body", "Paragraph", 300),
                            image("image", "Photo"), text("alt", "Describe the photo", 200)))),

            // Site-wide
            section("site.announcements", "Ticker", "Every page", "The scrolling messages in the thin bar at the very top.", "/",
                    strings("items", "Messages", 8, 80).hint("One per line. {freeShipping} and {store} are filled in automatically."),
                    link("link", "Clicking the bar goes to")),
            section("site.header", "Top menu", "Every page", "The links in the top bar on computers, and the drop-down panel.", "/",
                    list("nav", "Menu links", 6,
                            text("label", "Text", 30).mandatory(), link("link", "Goes to").mandatory(),
                            toggle("showPanel", "Open the drop-down panel on hover")).itemLabel("label"),
                    text("panelEyebrow", "Drop-down small label", 40),
                    text("panelTitle", "Drop-down headline", 80),
                    text("panelLinkLabel", "Drop-down link text", 40),
                    link("panelLink", "Drop-down link goes to"),
                    list("panel", "Drop-down panel", 4,
                            text("label", "Title", 40).mandatory(), link("link", "Goes to").mandatory(),
                            image("image", "Photo").mandatory(), text("note", "Short note", 60)).itemLabel("label")),
            section("site.mobileMenu", "Phone menu", "Every page", "The full-screen menu that opens from ☰ on phones.", "/",
                    list("links", "Links", 8, text("label", "Text", 30).mandatory(), link("link", "Goes to").mandatory()).itemLabel("label"),
                    image("promoImage", "Promo photo"),
                    text("promoEyebrow", "Promo small label", 40),
                    text("promoTitle", "Promo title", 60),
                    link("promoLink", "Promo goes to")),
            section("site.footer", "Footer", "Every page", "The bottom of every page.", "/",
                    textarea("blurb", "Short description", 300),
                    list("columns", "Link columns", 4,
                            text("title", "Column title", 30).mandatory(),
                            list("links", "Links", 8, text("label", "Text", 40).mandatory(), link("link", "Goes to").mandatory()).itemLabel("label"))
                            .itemLabel("title"),
                    list("socials", "Social links", 6, text("label", "Name", 30).mandatory(),
                            link("link", "Address").hint("Leave empty to show “coming soon”.")).itemLabel("label"),
                    text("copyright", "Copyright line", 120).hint("{year} and {store} are filled in automatically."),
                    list("legal", "Small links at the bottom", 6, text("label", "Text", 40).mandatory(), link("link", "Goes to").mandatory()).itemLabel("label")),
            section("site.search", "Search suggestions", "Every page", "Words suggested when someone opens search.", "/",
                    strings("suggestions", "Suggestions", 10, 30)),

            // Pages
            section("page.shopAll", "Shop all page", "Pages", "The heading and intro at the top of /shop. Collection pages are edited under Collections.", "/shop",
                    concat(of(text("eyebrow", "Small label", 60), text("title", "Page title (browser tab)", 60)), heading(""), of(
                            textarea("intro", "Intro paragraph", 400)))),
            section("page.offers", "Offers page", "Pages",
                    "The /offers page. Products appear here when you tick the “Offers” collection on them in Products. The round badge and countdown come from Power-Up Deal.", "/offers",
                    text("eyebrow", "Small label", 40),
                    text("line1", "Headline, first line", 50).mandatory(),
                    text("line2", "Headline, second line (gold, italic)", 50),
                    textarea("intro", "Paragraph", 300).hint("{freeShipping} and {store} are filled in automatically."),
                    text("emptyTitle", "When no products are on offer: title", 60),
                    textarea("emptyBody", "When no products are on offer: text", 200)),
            section("page.about", "Our story page", "Pages", "Everything on /about, including your policies.", "/about",
                    concat(of(text("eyebrow", "Small label", 60)), heading(""), of(
                            image("heroImage", "Main photo for computers (landscape)"),
                            image("heroImageMobile", "Main photo for phones (portrait)"),
                            text("heroAlt", "Describe the photo", 200),
                            text("ideaLabel", "Section label", 40),
                            textarea("ideaLead", "Big opening paragraph", 600).hint("{store} is filled in automatically."),
                            textarea("ideaBody1", "Paragraph", 600),
                            textarea("ideaBody2", "Paragraph", 600),
                            strings("marquee", "Scrolling words", 8, 40),
                            image("sideImage", "Side photo"), text("sideAlt", "Describe the side photo", 200),
                            text("beliefsLine1", "Beliefs headline", 40), text("beliefsLine2", "Beliefs headline, italics", 40),
                            list("principles", "Beliefs", 6, text("title", "Title", 60).mandatory(), textarea("body", "Paragraph", 300)).itemLabel("title"),
                            toggle("showDetails", "Show “The details” points from the home page"),
                            text("careLine1", "Customer care headline", 40), text("careLine2", "Customer care headline, italics", 40),
                            text("careNote", "Stamp next to the headline (optional)", 80),
                            list("policies", "Policies", 8,
                                    text("anchor", "Link name", 30).mandatory().hint("Lower-case, e.g. shipping. Lets links like /about#shipping jump here."),
                                    text("title", "Title", 60).mandatory(),
                                    textarea("body", "Text", 2000).hint("Leave a blank line between paragraphs. {email} is filled in automatically.")).itemLabel("title"),
                            text("primaryLabel", "Main button text", 40), link("primaryLink", "Main button goes to"),
                            text("secondaryLabel", "Second button text", 40), link("secondaryLink", "Second button goes to")))),

            // Product page
            section("product.page", "Product page notes", "Product page", "Small print on every product page.", "/shop",
                    text("priceNote", "Under the price", 80),
                    text("shippingNote", "Under the Add to bag button", 200).hint("{freeShipping} is filled in from Store settings."),
                    textarea("shippingReturns", "“Shipping & returns” panel", 800)),
            section("product.sizeGuide", "Size guide", "Product page", "Garment measurements in centimetres, measured flat.", "/shop",
                    textarea("intro", "Intro", 300),
                    list("oversized", "Oversized fit measurements", 8,
                            select("size", "Size", SIZES), number("chest", "Chest (cm)", 30, 250), number("length", "Length (cm)", 30, 150),
                            number("shoulder", "Shoulder (cm)", 20, 120)).itemLabel("size"),
                    textarea("oversizedAdvice", "Oversized fit advice", 300),
                    list("regular", "Regular fit measurements", 8,
                            select("size", "Size", SIZES), number("chest", "Chest (cm)", 30, 250), number("length", "Length (cm)", 30, 150),
                            number("shoulder", "Shoulder (cm)", 20, 120)).itemLabel("size"),
                    textarea("regularAdvice", "Regular fit advice", 300)));

    public static Optional<Section> find(String key) {
        return SECTIONS.stream().filter(s -> s.key().equals(key)).findFirst();
    }

    public static Optional<String> labelOf(String key) {
        return find(key).map(Section::label);
    }
}
