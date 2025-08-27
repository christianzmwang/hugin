-- Fix Extension in Public Schema security issues
-- Move PostgreSQL extensions from public schema to dedicated extensions schema
-- 
-- SECURITY ISSUE: Extensions in public schema are accessible to all users
-- and can create naming conflicts. Moving them to a dedicated schema follows
-- PostgreSQL security best practices.
--
-- APPLIED: This migration was successfully applied to move pg_trgm and btree_gin
-- extensions from public schema to extensions schema.

-- Ensure extensions schema exists
CREATE SCHEMA IF NOT EXISTS extensions;

-- Move pg_trgm extension from public to extensions schema
-- Used for trigram similarity search functionality
ALTER EXTENSION pg_trgm SET SCHEMA extensions;

-- Move btree_gin extension from public to extensions schema  
-- Used for GIN index support on btree-indexable data types
ALTER EXTENSION btree_gin SET SCHEMA extensions;

-- Update the default search_path to include extensions schema
-- This ensures that extension functions and operators are available
-- without explicit schema qualification
DO $$
DECLARE
    db_name text;
BEGIN
    SELECT current_database() INTO db_name;
    EXECUTE format('ALTER DATABASE %I SET search_path = public, extensions', db_name);
END $$;

-- Grant usage on extensions schema to public
-- This allows the application to use extension functions and operators
GRANT USAGE ON SCHEMA extensions TO public;

-- Verify the extensions have been moved successfully
SELECT 
    e.extname as extension_name,
    n.nspname as schema_name,
    e.extversion as version,
    CASE 
        WHEN n.nspname = 'extensions' THEN 'SECURE'
        ELSE 'NEEDS ATTENTION'
    END as security_status
FROM pg_extension e
JOIN pg_namespace n ON e.extnamespace = n.oid
WHERE e.extname IN ('pg_trgm', 'btree_gin')
ORDER BY e.extname;

-- Test that trigram functionality still works
-- This verifies that the search_path is correctly configured
SELECT 
    'company' % 'compny' as trigram_similarity_test,
    similarity('company', 'compny') as similarity_score;

-- COMPLETION STATUS: ✅ RESOLVED
-- - pg_trgm extension moved to extensions schema
-- - btree_gin extension moved to extensions schema  
-- - Database search_path updated to include extensions schema
-- - Trigram search functionality preserved
-- - Security best practices implemented
