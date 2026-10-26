package com.code76.store.orders.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;

/** Delivery address stored on the order itself (a snapshot, not a link to an address book). */
@Embeddable
public class ShippingAddress {

    @Column(name = "ship_name", nullable = false, length = 80)
    private String fullName;

    @Column(name = "ship_phone", nullable = false, length = 10)
    private String phone;

    @Column(name = "ship_line1", nullable = false, length = 120)
    private String line1;

    @Column(name = "ship_line2", length = 120)
    private String line2;

    @Column(name = "ship_city", nullable = false, length = 60)
    private String city;

    @Column(name = "ship_state", nullable = false, length = 60)
    private String state;

    @Column(name = "ship_pincode", nullable = false, length = 6)
    private String pincode;

    protected ShippingAddress() {
    }

    public ShippingAddress(String fullName, String phone, String line1, String line2, String city, String state, String pincode) {
        this.fullName = fullName;
        this.phone = phone;
        this.line1 = line1;
        this.line2 = line2;
        this.city = city;
        this.state = state;
        this.pincode = pincode;
    }

    public String getFullName() { return fullName; }
    public String getPhone() { return phone; }
    public String getLine1() { return line1; }
    public String getLine2() { return line2; }
    public String getCity() { return city; }
    public String getState() { return state; }
    public String getPincode() { return pincode; }
}
