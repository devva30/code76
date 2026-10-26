package com.code76.store.content;

import com.code76.store.admin.ImageUrls;
import com.code76.store.catalogue.repository.ProductRepository;
import com.code76.store.common.error.ApiError.FieldProblem;
import com.code76.store.content.ContentSchema.Field;
import com.code76.store.content.ContentSchema.Section;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.regex.Pattern;

/**
 * Checks a section against its schema and returns a clean copy: only known fields, trimmed text,
 * safe links, images from the library, products that exist. Text is always shown as plain text on
 * the site (never as HTML), so nothing typed here can run as code.
 */
@Component
public class ContentValidator {

    /** A page on this site ("/shop", "/about#shipping"), a secure web address, or an email link. */
    private static final Pattern SITE_PATH = Pattern.compile("^/(?![/\\\\])\\S*$");
    private static final Pattern HTTPS = Pattern.compile("^https://[^\\s<>\"]+$");
    private static final Pattern MAILTO = Pattern.compile("^mailto:[^\\s@<>\"]+@[^\\s@<>\"]+$");
    private static final Pattern SLUG = Pattern.compile("^[a-z0-9]+(-[a-z0-9]+)*$");
    private static final Pattern FOCUS = Pattern.compile("^\\d{1,3}% \\d{1,3}%$");

    public record Result(Map<String, Object> cleaned, List<FieldProblem> problems) {
    }

    private final ImageUrls images;
    private final ProductRepository products;

    public ContentValidator(ImageUrls images, ProductRepository products) {
        this.images = images;
        this.products = products;
    }

    public Result validate(Section section, Map<?, ?> input) {
        List<FieldProblem> problems = new ArrayList<>();
        Map<String, Object> cleaned = object(section.fields(), input == null ? Map.of() : input, "", problems);
        return new Result(cleaned, problems);
    }

    public static boolean isSafeLink(String link) {
        return link.length() <= 300 && (SITE_PATH.matcher(link).matches() || HTTPS.matcher(link).matches() || MAILTO.matcher(link).matches());
    }

    private Map<String, Object> object(List<Field> fields, Map<?, ?> in, String prefix, List<FieldProblem> problems) {
        Map<String, Object> out = new LinkedHashMap<>();
        for (Field f : fields) {
            Object value = in.get(f.key());
            String path = prefix + f.key();
            switch (f.type()) {
                case "text", "textarea" -> {
                    String s = f.type().equals("text") ? str(value).strip().replaceAll("\\s+", " ") : str(value).strip().replace("\r\n", "\n");
                    if (f.max() != null && s.length() > f.max()) {
                        problems.add(new FieldProblem(path, "must be at most " + f.max() + " characters"));
                    }
                    if (f.required() && s.isEmpty()) {
                        problems.add(new FieldProblem(path, "is required"));
                    }
                    if (f.key().toLowerCase().contains("position") && !s.isEmpty() && !FOCUS.matcher(s).matches()) {
                        problems.add(new FieldProblem(path, "must look like 50% 40%"));
                    }
                    out.put(f.key(), s);
                }
                case "image" -> {
                    String s = str(value).strip();
                    if (s.isEmpty()) {
                        if (f.required()) {
                            problems.add(new FieldProblem(path, "is required"));
                        }
                    } else if (!images.isAllowed(s)) {
                        problems.add(new FieldProblem(path, "must be an image from the media library"));
                    }
                    out.put(f.key(), s);
                }
                case "link" -> {
                    String s = str(value).strip();
                    if (s.isEmpty()) {
                        if (f.required()) {
                            problems.add(new FieldProblem(path, "is required"));
                        }
                    } else if (!isSafeLink(s)) {
                        problems.add(new FieldProblem(path, "must be a page on this site (starting with /) or an https:// address"));
                    }
                    out.put(f.key(), s);
                }
                case "select" -> {
                    // Not chosen yet (e.g. a setting added after this content was saved): use the first choice.
                    String given = str(value).strip();
                    String s = given.isEmpty() && !f.options().isEmpty() ? f.options().getFirst().value() : given;
                    boolean known = f.options().stream().anyMatch(o -> o.value().equals(s));
                    if (!known) {
                        problems.add(new FieldProblem(path, "must be one of the listed choices"));
                    }
                    out.put(f.key(), s);
                }
                case "toggle" -> out.put(f.key(), value instanceof Boolean b && b);
                case "number" -> {
                    Integer n = value instanceof Number num ? Integer.valueOf(num.intValue()) : parse(str(value));
                    if (n == null) {
                        problems.add(new FieldProblem(path, "must be a number"));
                    } else if ((f.min() != null && n < f.min()) || (f.max() != null && n > f.max())) {
                        problems.add(new FieldProblem(path, "must be between " + f.min() + " and " + f.max()));
                    }
                    out.put(f.key(), n == null ? 0 : n);
                }
                case "product" -> {
                    String s = str(value).strip();
                    if (s.isEmpty()) {
                        if (f.required()) {
                            problems.add(new FieldProblem(path, "is required"));
                        }
                    } else if (!SLUG.matcher(s).matches() || !products.existsBySlug(s)) {
                        problems.add(new FieldProblem(path, "is not a product in the store"));
                    }
                    out.put(f.key(), s);
                }
                case "strings" -> {
                    List<String> items = new ArrayList<>();
                    if (value instanceof List<?> raw) {
                        for (Object o : raw) {
                            String s = str(o).strip();
                            if (s.isEmpty()) {
                                continue;
                            }
                            if (f.max() != null && s.length() > f.max()) {
                                problems.add(new FieldProblem(path + "[" + items.size() + "]", "must be at most " + f.max() + " characters"));
                            }
                            items.add(s);
                        }
                    }
                    if (f.maxItems() != null && items.size() > f.maxItems()) {
                        problems.add(new FieldProblem(path, "can have at most " + f.maxItems() + " items"));
                    }
                    out.put(f.key(), items);
                }
                case "list" -> {
                    List<Map<String, Object>> items = new ArrayList<>();
                    if (value instanceof List<?> raw) {
                        for (int i = 0; i < raw.size(); i++) {
                            Map<?, ?> item = raw.get(i) instanceof Map<?, ?> m ? m : Map.of();
                            items.add(object(f.fields(), item, path + "[" + i + "].", problems));
                        }
                    }
                    if (f.maxItems() != null && items.size() > f.maxItems()) {
                        problems.add(new FieldProblem(path, "can have at most " + f.maxItems() + " items"));
                    }
                    out.put(f.key(), items);
                }
                default -> throw new IllegalStateException("Unknown field type " + f.type());
            }
        }
        return out;
    }

    private static String str(Object value) {
        return value == null ? "" : value instanceof String s ? s : String.valueOf(value);
    }

    private static Integer parse(String s) {
        try {
            return Integer.valueOf(s.strip());
        } catch (NumberFormatException e) {
            return null;
        }
    }
}
