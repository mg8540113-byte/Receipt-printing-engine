-- ============================================
-- RPC: fetch_vouchers_for_external_order
-- ============================================
-- Worker calls this function to fetch voucher data for an external order batch.
-- Returns the same 11-field VoucherRow structure as fetch_vouchers_for_print,
-- so all downstream code (PDF generator, RTL, barcode) works unchanged.
-- Fields with no equivalent in external_orders are filled with safe defaults.
-- ORDER BY v.id ensures deterministic order across retries.
-- ============================================

CREATE OR REPLACE FUNCTION fetch_vouchers_for_external_order(
    p_external_order_id UUID,
    p_template_type     INTEGER,
    p_offset_start      INTEGER,
    p_limit_count       INTEGER
)
RETURNS TABLE (
    voucher_id       UUID,
    barcode_code     VARCHAR(50),
    title_before     VARCHAR(50),
    first_name       VARCHAR(100),
    last_name        VARCHAR(100),
    title_after      VARCHAR(50),
    id_number        VARCHAR(9),
    phone            VARCHAR(20),
    avrech_code      INTEGER,
    institution_name VARCHAR(255),
    institution_code VARCHAR(50)
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT
        v.id                            AS voucher_id,
        b.code                          AS barcode_code,
        NULL::VARCHAR(50)               AS title_before,
        eo.full_name::VARCHAR(100)      AS first_name,
        NULL::VARCHAR(100)              AS last_name,
        NULL::VARCHAR(50)               AS title_after,
        eo.id_number::VARCHAR(9)        AS id_number,
        eo.phone::VARCHAR(20)           AS phone,
        0::INTEGER                      AS avrech_code,
        'הזמנות חיצוניות'::VARCHAR(255) AS institution_name,
        'external'::VARCHAR(50)         AS institution_code
    FROM vouchers v
    JOIN external_orders eo ON eo.id = v.external_order_id
    JOIN barcodes        b  ON b.id  = v.barcode_id
    WHERE v.external_order_id = p_external_order_id
      AND v.value             = p_template_type
    ORDER BY v.id
    OFFSET p_offset_start
    LIMIT  p_limit_count;
END;
$$;

GRANT EXECUTE ON FUNCTION fetch_vouchers_for_external_order(UUID, INTEGER, INTEGER, INTEGER) TO service_role;
