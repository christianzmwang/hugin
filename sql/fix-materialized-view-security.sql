-- Fix Materialized View in API security issues
-- Secure access to materialized views by creating controlled access patterns
--
-- SECURITY ISSUE: Large materialized views (business_filter_matrix: 607MB, business_summary_fast: 443MB)
-- are directly accessible through API endpoints without proper access controls.
--
-- SOLUTION: Create secure access patterns using views and functions with proper security settings.

-- Create a schema for secure API access
CREATE SCHEMA IF NOT EXISTS api_secure;

-- Grant usage to the application (adjust role name as needed)
GRANT USAGE ON SCHEMA api_secure TO public;

-- Create a secure view for business filtering that limits exposed columns
CREATE OR REPLACE VIEW api_secure.business_filter_view AS
SELECT 
    id,
    org_number,
    name,
    industry_code1,
    industry_text1,
    sector_code,
    sector_text,
    org_form_code,
    org_form_text,
    vat_registered,
    employees,
    revenue,
    operating_result,
    address_city,
    address_postal_code,
    revenue_bucket,
    employee_bucket,
    profitability_status
FROM public.business_filter_matrix
-- Add any business logic filters here, e.g.:
-- WHERE some_security_condition = true
;

-- Create a secure function for business summary access with proper limits
CREATE OR REPLACE FUNCTION api_secure.get_business_summary(
    p_limit INTEGER DEFAULT 100,
    p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
    id INTEGER,
    org_number TEXT,
    name TEXT,
    industry_code1 TEXT,
    industry_text1 TEXT,
    revenue BIGINT,
    employees INTEGER,
    address_city TEXT,
    revenue_bucket TEXT,
    employee_bucket TEXT
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public, api_secure
AS $$
    SELECT 
        bf.id,
        bf.org_number,
        bf.name,
        bf.industry_code1,
        bf.industry_text1,
        bf.revenue,
        bf.employees,
        bf.address_city,
        bf.revenue_bucket,
        bf.employee_bucket
    FROM public.business_filter_matrix bf
    WHERE bf.id IS NOT NULL  -- Add actual business logic filters here
    ORDER BY bf.id
    LIMIT LEAST(GREATEST(p_limit, 1), 200)  -- Enforce reasonable limits
    OFFSET GREATEST(p_offset, 0);
$$;

-- Create a secure function for filtered business search
CREATE OR REPLACE FUNCTION api_secure.search_businesses(
    p_industry_code TEXT DEFAULT NULL,
    p_city TEXT DEFAULT NULL,
    p_revenue_bucket TEXT DEFAULT NULL,
    p_employee_bucket TEXT DEFAULT NULL,
    p_search_term TEXT DEFAULT NULL,
    p_limit INTEGER DEFAULT 100,
    p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
    id INTEGER,
    org_number TEXT,
    name TEXT,
    industry_text1 TEXT,
    revenue BIGINT,
    employees INTEGER,
    address_city TEXT,
    revenue_bucket TEXT,
    employee_bucket TEXT,
    sector_code TEXT,
    sector_text TEXT,
    vat_registered BOOLEAN
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public, extensions, api_secure
AS $$
    SELECT 
        bf.id,
        bf.org_number,
        bf.name,
        bf.industry_text1,
        bf.revenue,
        bf.employees,
        bf.address_city,
        bf.revenue_bucket,
        bf.employee_bucket,
        bf.sector_code,
        bf.sector_text,
        bf.vat_registered
    FROM public.business_filter_matrix bf
    WHERE 
        (p_industry_code IS NULL OR bf.industry_code1 = p_industry_code)
        AND (p_city IS NULL OR bf.address_city ILIKE '%' || p_city || '%')
        AND (p_revenue_bucket IS NULL OR bf.revenue_bucket = p_revenue_bucket)
        AND (p_employee_bucket IS NULL OR bf.employee_bucket = p_employee_bucket)
        AND (p_search_term IS NULL OR (
            bf.name ILIKE '%' || p_search_term || '%' 
            OR (length(p_search_term) >= 3 AND bf.name % p_search_term)
        ))
    ORDER BY 
        CASE 
            WHEN p_search_term IS NOT NULL AND length(p_search_term) >= 3 
            THEN similarity(bf.name, p_search_term) 
            ELSE 0 
        END DESC,
        bf.revenue DESC NULLS LAST,
        bf.id
    LIMIT LEAST(GREATEST(p_limit, 1), 200)
    OFFSET GREATEST(p_offset, 0);
$$;

-- Revoke direct access to materialized views from public
-- Note: This is commented out to avoid breaking existing functionality immediately
-- Uncomment after updating the application code to use the secure functions

-- REVOKE SELECT ON public.business_filter_matrix FROM public;
-- REVOKE SELECT ON public.business_summary_fast FROM public;

-- Grant access to the secure API functions
GRANT EXECUTE ON FUNCTION api_secure.get_business_summary(INTEGER, INTEGER) TO public;
GRANT EXECUTE ON FUNCTION api_secure.search_businesses(TEXT, TEXT, TEXT, TEXT, TEXT, INTEGER, INTEGER) TO public;
GRANT SELECT ON api_secure.business_filter_view TO public;

-- Create indexes on commonly filtered columns for better performance
CREATE INDEX IF NOT EXISTS idx_business_filter_industry_code1 
ON public.business_filter_matrix(industry_code1) 
WHERE industry_code1 IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_business_filter_city 
ON public.business_filter_matrix(address_city) 
WHERE address_city IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_business_filter_revenue_bucket 
ON public.business_filter_matrix(revenue_bucket) 
WHERE revenue_bucket IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_business_filter_employee_bucket 
ON public.business_filter_matrix(employee_bucket) 
WHERE employee_bucket IS NOT NULL;

-- Create a composite index for common search patterns
CREATE INDEX IF NOT EXISTS idx_business_filter_search 
ON public.business_filter_matrix(industry_code1, revenue_bucket, address_city) 
WHERE industry_code1 IS NOT NULL OR revenue_bucket IS NOT NULL OR address_city IS NOT NULL;

-- Test the secure functions
SELECT 'Testing secure business summary function...' as test_step;
SELECT COUNT(*) as total_accessible FROM api_secure.get_business_summary(5, 0);

SELECT 'Testing secure business search function...' as test_step;  
SELECT COUNT(*) as search_results FROM api_secure.search_businesses(NULL, NULL, NULL, NULL, 'test', 5, 0);

-- COMPLETION STATUS: 🔄 IN PROGRESS
-- Next steps:
-- 1. Update application code to use secure functions instead of direct materialized view access
-- 2. Test that all API functionality works with new secure access patterns
-- 3. Revoke direct access to materialized views once migration is complete
