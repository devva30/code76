package com.code76.store.orders;

import com.code76.store.orders.dto.OrderDtos.AddressRequest;
import com.code76.store.orders.service.IndianStates;
import com.code76.store.orders.service.OrderNumberGenerator;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

import java.time.Duration;
import java.util.HashSet;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;

/** Plain unit tests for the small rules: shipping, phone clean-up, states, order numbers. */
class OrderRulesTest {

    final ShopProperties shop = new ShopProperties(299900, 9900, 10, 20, Duration.ofMinutes(30));

    @Test
    void shippingIsFreeAtOrAboveTheThresholdAndZeroForAnEmptyBag() {
        assertThat(shop.shippingFor(0)).isZero();
        assertThat(shop.shippingFor(169000)).isEqualTo(9900);
        assertThat(shop.shippingFor(299899)).isEqualTo(9900);
        assertThat(shop.shippingFor(299900)).isZero();
    }

    @ParameterizedTest(name = "\"{0}\" -> {1}")
    @CsvSource({
            "9876543210, 9876543210",
            "98765 43210, 9876543210",
            "+91 98765-43210, 9876543210",
            "+919876543210, 9876543210",
            "919876543210, 9876543210",
            "09876543210, 9876543210",
            "(98765) 43210, 9876543210",
    })
    void indianMobileNumbersAreNormalisedToTenDigits(String typed, String stored) {
        AddressRequest address = new AddressRequest("A", typed, "1 Road", null, "City", "Goa", "403001");
        assertThat(address.phone()).isEqualTo(stored);
    }

    @Test
    void blankSecondAddressLineBecomesNull() {
        assertThat(new AddressRequest("A", "9876543210", "1 Road", "   ", "City", "Goa", "403001").line2()).isNull();
    }

    @Test
    void all36StatesAndUnionTerritoriesAreAccepted() {
        assertThat(IndianStates.ALL).hasSize(36).doesNotHaveDuplicates();
        assertThat(IndianStates.isValid("Tamil Nadu")).isTrue();
        assertThat(IndianStates.isValid("tamil nadu")).isFalse();
        assertThat(IndianStates.isValid(null)).isFalse();
    }

    @Test
    void orderNumbersAreReadableAndRandom() {
        OrderNumberGenerator generator = new OrderNumberGenerator(mock(com.code76.store.orders.repository.CustomerOrderRepository.class));
        Set<String> seen = new HashSet<>();
        for (int i = 0; i < 1000; i++) {
            String number = generator.next();
            assertThat(number).matches(OrderNumberGenerator.PATTERN).doesNotContain("0", "O", "1", "I");
            seen.add(number);
        }
        assertThat(seen).hasSize(1000);
    }
}
