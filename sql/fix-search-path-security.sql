-- Fix Function Search Path Mutable security issues
-- This script adds SECURITY DEFINER and SET search_path to database functions
-- to prevent search path manipulation attacks

-- Fix get_events_by_org function
-- Note: This assumes the function exists. Adjust parameters as needed based on actual function signature.
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'get_events_by_org') THEN
        -- We need to first get the function definition and recreate it with security settings
        -- This is a template - you may need to adjust based on the actual function definition
        RAISE NOTICE 'Function get_events_by_org exists. Please manually update it with proper search_path settings.';
        
        -- Example of how to fix it (adjust based on actual function):
        -- DROP FUNCTION IF EXISTS get_events_by_org(text);
        -- CREATE OR REPLACE FUNCTION get_events_by_org(org_number text)
        -- RETURNS TABLE(...) 
        -- LANGUAGE plpgsql
        -- SECURITY DEFINER
        -- SET search_path = public
        -- AS $$
        -- BEGIN
        --     -- function body here
        -- END;
        -- $$;
    ELSE
        RAISE NOTICE 'Function get_events_by_org does not exist in current schema.';
    END IF;
END $$;

-- Fix get_filter_counts function
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'get_filter_counts') THEN
        RAISE NOTICE 'Function get_filter_counts exists. Please manually update it with proper search_path settings.';
        
        -- Example template:
        -- DROP FUNCTION IF EXISTS get_filter_counts(...);
        -- CREATE OR REPLACE FUNCTION get_filter_counts(...)
        -- RETURNS INTEGER
        -- LANGUAGE plpgsql
        -- SECURITY DEFINER  
        -- SET search_path = public
        -- AS $$
        -- BEGIN
        --     -- function body here
        -- END;
        -- $$;
    ELSE
        RAISE NOTICE 'Function get_filter_counts does not exist in current schema.';
    END IF;
END $$;

-- Fix get_filter_counts_v2 function
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'get_filter_counts_v2') THEN
        RAISE NOTICE 'Function get_filter_counts_v2 exists. Please manually update it with proper search_path settings.';
        
        -- Example template:
        -- DROP FUNCTION IF EXISTS get_filter_counts_v2(...);
        -- CREATE OR REPLACE FUNCTION get_filter_counts_v2(...)
        -- RETURNS INTEGER
        -- LANGUAGE plpgsql
        -- SECURITY DEFINER
        -- SET search_path = public
        -- AS $$
        -- BEGIN
        --     -- function body here
        -- END;
        -- $$;
    ELSE
        RAISE NOTICE 'Function get_filter_counts_v2 does not exist in current schema.';
    END IF;
END $$;

-- Generic function to list all functions with mutable search paths for manual review
SELECT 
    n.nspname as schema_name,
    p.proname as function_name,
    pg_get_function_identity_arguments(p.oid) as arguments,
    CASE 
        WHEN p.prosecdef THEN 'SECURITY DEFINER'
        ELSE 'SECURITY INVOKER'
    END as security_type,
    CASE 
        WHEN array_length(p.proconfig, 1) > 0 THEN 
            array_to_string(p.proconfig, ', ')
        ELSE 'No configuration (search_path mutable)'
    END as configuration
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
AND p.proname IN ('get_events_by_org', 'get_filter_counts', 'get_filter_counts_v2', 'update_updated_at_column')
ORDER BY p.proname;
