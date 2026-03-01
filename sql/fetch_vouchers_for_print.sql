-- ============================================
-- RPC: fetch_vouchers_for_print
-- ============================================
-- Worker calls this function to fetch voucher data for a specific batch.
-- Returns all fields needed to generate a single voucher page.
-- ORDER BY v.id ensures deterministic order across retries.
-- ============================================

CREATE OR REPLACE FUNCTION fetch_vouchers_for_print(
    p_group_id UUID,
    p_template_type INTEGER,
    p_offset_start INTEGER,
    p_limit_count INTEGER
)
RETURNS TABLE (
    voucher_id UUID,
    barcode_code VARCHAR(50),
    title_before VARCHAR(50),
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    title_after VARCHAR(50),
    id_number VARCHAR(9),
    phone VARCHAR(20),
    avrech_code INTEGER,
    institution_name VARCHAR(255),
    institution_code VARCHAR(50)
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT
        v.id            AS voucher_id,
        b.code          AS barcode_code,
        a.title_before,
        a.first_name,
        a.last_name,
        a.title_after,
        a.id_number,
        a.phone,
        a.avrech_code,
        inst.name       AS institution_name,
        inst.code       AS institution_code
    FROM vouchers v
    JOIN orders       o    ON o.id   = v.order_id
    JOIN avrechim     a    ON a.id   = o.avrech_id
    JOIN groups       g    ON g.id   = o.group_id
    JOIN institutions inst ON inst.id = g.institution_id
    JOIN barcodes     b    ON b.id   = v.barcode_id
    WHERE o.group_id = p_group_id
      AND v.value    = p_template_type
    ORDER BY v.id
    OFFSET p_offset_start
    LIMIT  p_limit_count;
END;
$$;

GRANT EXECUTE ON FUNCTION fetch_vouchers_for_print(UUID, INTEGER, INTEGER, INTEGER) TO service_role;
