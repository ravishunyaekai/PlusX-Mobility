-- Charge share listing fee: 199 INR + 18% GST, paid when the user submits the listing form.
--
-- charge_share.charger_status:
--   0 = paid, awaiting admin review    1 = approved    2 = rejected
--   3 = awaiting payment (new)         4 = payment failed (new)
--
-- charge_share_invoice.invoice_status:
--   0 = pending    1 = paid    2 = failed    3 = refunded

ALTER TABLE booking_price
    ADD COLUMN charge_share_listing_price DECIMAL(10,2) NOT NULL DEFAULT 199.00;

CREATE TABLE charge_share_invoice (
    id                INT AUTO_INCREMENT PRIMARY KEY,
    invoice_id        VARCHAR(50)   NOT NULL UNIQUE,
    charger_id        VARCHAR(50)   NOT NULL,
    rider_id          VARCHAR(50)   NOT NULL,
    base_amount       DECIMAL(10,2) NOT NULL,
    gst_percent       DECIMAL(5,2)  NOT NULL DEFAULT 18.00,
    gst_amount        DECIMAL(10,2) NOT NULL,
    total_amount      DECIMAL(10,2) NOT NULL,
    currency          VARCHAR(10)   DEFAULT 'INR',
    invoice_status    TINYINT       NOT NULL DEFAULT 0 COMMENT '0 = pending, 1 = paid, 2 = failed, 3 = refunded',
    order_id          VARCHAR(100)  NULL,
    payment_intent_id VARCHAR(100)  NULL,
    payment_type      VARCHAR(50)   NULL,
    card_data         JSON          NULL,
    invoice_date      DATETIME      NULL,
    refund_id         VARCHAR(100)  NULL,
    refund_status     VARCHAR(30)   NULL,
    refund_amount     DECIMAL(10,2) NULL,
    refunded_at       DATETIME      NULL,
    created_at        DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at        DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    KEY idx_charger_id (charger_id),
    KEY idx_rider_id (rider_id),
    KEY idx_order_id (order_id)
);
