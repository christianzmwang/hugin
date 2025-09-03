-- Performance optimizations: indexes and fast count function
-- Safe, idempotent operations using IF NOT EXISTS where possible

-- 1) Latest financials access pattern
CREATE INDEX IF NOT EXISTS idx_financial_latest
ON "FinancialReport"("businessId", "fiscalYear" DESC);

-- Optional: a materialized view with only latest financials per business
-- Uncomment when ready and backfill/refresh on a schedule
-- CREATE MATERIALIZED VIEW IF NOT EXISTS public.business_financial_latest AS
-- SELECT DISTINCT ON (f."businessId")
--   f."businessId",
--   f."fiscalYear",
--   f.revenue,
--   f.profit,
--   f."totalAssets",
--   f.equity,
--   f."employeesAvg",
--   f."operatingIncome",
--   f."operatingResult",
--   f."profitBeforeTax",
--   f.valuta,
--   f."fraDato",
--   f."tilDato",
--   f."sumDriftsinntekter",
--   f.driftsresultat,
--   f.aarsresultat,
--   f."sumEiendeler",
--   f."sumEgenkapital",
--   f."sumGjeld"
-- FROM "FinancialReport" f
-- ORDER BY f."businessId", f."fiscalYear" DESC NULLS LAST;
-- CREATE INDEX IF NOT EXISTS business_financial_latest_business_idx ON public.business_financial_latest("businessId");

-- 2) Events lookups
CREATE INDEX IF NOT EXISTS events_org_idx ON public.events_public(org_number);
CREATE INDEX IF NOT EXISTS events_type_org_idx ON public.events_public(event_type, org_number);

-- 3) Business core filters
CREATE INDEX IF NOT EXISTS business_orgnumber_idx ON "Business"("orgNumber");
CREATE INDEX IF NOT EXISTS business_orgform_idx ON "Business"("orgFormCode");
CREATE INDEX IF NOT EXISTS business_city_idx ON "Business"("addressCity");
CREATE INDEX IF NOT EXISTS business_updatedat_idx ON "Business"("updatedAt");

-- 4) Trigram text search (requires pg_trgm; repo moves it to extensions schema already)
CREATE INDEX IF NOT EXISTS business_name_trgm ON "Business" USING gin (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS business_industry_text1_trgm ON "Business" USING gin ("industryText1" gin_trgm_ops);

-- 5) business_filter_matrix acceleration
CREATE INDEX IF NOT EXISTS bfm_org_idx ON public.business_filter_matrix(org_number);
CREATE INDEX IF NOT EXISTS bfm_name_trgm ON public.business_filter_matrix USING gin (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS bfm_search_vector_gin ON public.business_filter_matrix USING gin (search_vector);
CREATE INDEX IF NOT EXISTS bfm_revenue_idx ON public.business_filter_matrix(revenue);
CREATE INDEX IF NOT EXISTS bfm_employees_idx ON public.business_filter_matrix(employees);
CREATE INDEX IF NOT EXISTS bfm_city_idx ON public.business_filter_matrix(address_city);
CREATE INDEX IF NOT EXISTS bfm_industry_code_idx ON public.business_filter_matrix(industry_code1);
CREATE INDEX IF NOT EXISTS bfm_org_form_idx ON public.business_filter_matrix(org_form_code);
CREATE INDEX IF NOT EXISTS bfm_has_events_idx ON public.business_filter_matrix(has_events);

-- 6) Watchlist support
CREATE INDEX IF NOT EXISTS watchlist_user_created_idx ON watchlist(user_id, created_at DESC);

-- 7) Fast count function using business_filter_matrix
CREATE OR REPLACE FUNCTION public.get_fast_business_count()
RETURNS integer
LANGUAGE sql
STABLE
AS $$
  SELECT COUNT(*)::int FROM public.business_filter_matrix;
$$;

-- End of performance optimizations
