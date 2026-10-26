package com.code76.store.admin.api;

import com.code76.store.admin.audit.AdminAuditService;
import com.code76.store.admin.audit.AdminAuditService.AuditEntry;
import com.code76.store.catalogue.dto.CatalogueDtos.Money;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/** The admin dashboard: what needs attention today. */
@RestController
@RequestMapping("/api/admin")
public class AdminOverviewController {

    public record LowStockItem(String sku, String productName, String productSlug, String colorName, String size, int available) {
    }

    public record Overview(long ordersToShip, long awaitingPayment, long ordersToday, Money revenueLast7Days, long paidOrdersLast7Days,
                           long publishedProducts, long draftProducts, long customers, List<LowStockItem> lowStock) {
    }

    private static final String PAID = "('CONFIRMED', 'SHIPPED', 'DELIVERED')";

    private final JdbcTemplate jdbc;
    private final AdminAuditService audit;

    public AdminOverviewController(JdbcTemplate jdbc, AdminAuditService audit) {
        this.jdbc = jdbc;
        this.audit = audit;
    }

    @GetMapping("/overview")
    @Transactional(readOnly = true)
    public Overview overview() {
        long toShip = count("select count(*) from orders where status = 'CONFIRMED'");
        long awaiting = count("select count(*) from orders where status = 'PENDING_PAYMENT'");
        // "Today" in India, whatever the server's own time zone is.
        long today = count("select count(*) from orders where (placed_at at time zone 'Asia/Kolkata')::date = (now() at time zone 'Asia/Kolkata')::date");
        long revenue = count("select coalesce(sum(total_paise), 0) from orders where status in " + PAID + " and paid_at > now() - interval '7 days'");
        long paidCount = count("select count(*) from orders where status in " + PAID + " and paid_at > now() - interval '7 days'");
        long published = count("select count(*) from products where status = 'PUBLISHED'");
        long drafts = count("select count(*) from products where status = 'DRAFT'");
        long customers = count("select count(*) from users where role = 'CUSTOMER'");
        List<LowStockItem> low = jdbc.query("""
                select v.sku, p.name, p.slug, c.name as color, v.size, greatest(0, i.quantity_on_hand - i.quantity_reserved) as available
                from product_variants v
                join inventory i on i.variant_id = v.id
                join products p on p.id = v.product_id
                join product_colors c on c.id = v.color_id
                where v.active and p.status = 'PUBLISHED' and i.quantity_on_hand - i.quantity_reserved <= 3
                order by available, p.name, v.size
                limit 12""",
                (rs, n) -> new LowStockItem(rs.getString("sku"), rs.getString("name"), rs.getString("slug"), rs.getString("color"),
                        rs.getString("size"), rs.getInt("available")));
        return new Overview(toShip, awaiting, today, Money.inr(revenue), paidCount, published, drafts, customers, low);
    }

    @GetMapping("/activity")
    public List<AuditEntry> activity() {
        return audit.recent(100);
    }

    private long count(String sql) {
        Long value = jdbc.queryForObject(sql, Long.class);
        return value == null ? 0 : value;
    }
}
