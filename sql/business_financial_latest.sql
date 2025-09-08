-- Materialized view for latest financials per business
-- Provides fast access to latest revenue/profit without LATERAL joins
CREATE MATERIALIZED VIEW IF NOT EXISTS public.business_financial_latest AS
SELECT DISTINCT ON (f."businessId")
  f."businessId",
  f."fiscalYear",
  f.revenue,
  f.profit,
  f."totalAssets",
  f.equity,
  f."employeesAvg",
  f."operatingIncome",
  f."operatingResult",
  f."profitBeforeTax",
  f.valuta,
  f."fraDato",
  f."tilDato",
  f."sumDriftsinntekter",
  f.driftsresultat,
  f.aarsresultat,
  f."sumEiendeler",
  f."sumEgenkapital",
  f."sumGjeld"
FROM "FinancialReport" f
ORDER BY f."businessId", f."fiscalYear" DESC NULLS LAST;

-- Helpful indexes
CREATE INDEX IF NOT EXISTS business_financial_latest_business_idx ON public.business_financial_latest("businessId");
CREATE INDEX IF NOT EXISTS business_financial_latest_revenue_idx ON public.business_financial_latest(revenue);
CREATE INDEX IF NOT EXISTS business_financial_latest_profit_idx ON public.business_financial_latest(profit);

-- Convenience function to refresh quickly (CONCURRENTLY disabled unless MV has a unique index)
CREATE OR REPLACE FUNCTION public.refresh_business_financial_latest()
RETURNS void
LANGUAGE sql
AS $$
  REFRESH MATERIALIZED VIEW public.business_financial_latest;
$$;

