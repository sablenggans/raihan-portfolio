-- =====================================================
-- Phase 5: portfolio-public Storage access
-- =====================================================
-- Dependencies:
--   20261027_01_core_schema.sql: admin_users exists.
--   20261027_02_rls_policies.sql: public.is_admin() exists.
--   20261027_04_admin_users_policy.sql: required before uploads work.
--
-- This migration does not change portfolio-documents, application tables,
-- authentication, or existing CRUD policies.
--
-- Supabase Storage uses bucket_id in storage.objects. This migration keeps
-- bucket id and bucket name identical: portfolio-public.

DO $$
DECLARE
  existing_bucket_id text;
BEGIN
  SELECT id
    INTO existing_bucket_id
    FROM storage.buckets
   WHERE name = 'portfolio-public';

  IF existing_bucket_id IS NULL THEN
    INSERT INTO storage.buckets (
      id,
      name,
      public,
      file_size_limit,
      allowed_mime_types
    )
    VALUES (
      'portfolio-public',
      'portfolio-public',
      true,
      5242880,
      ARRAY['image/jpeg', 'image/png', 'image/webp']::text[]
    );
  ELSIF existing_bucket_id <> 'portfolio-public' THEN
    RAISE EXCEPTION
      'Bucket portfolio-public exists with id %, expected id portfolio-public',
      existing_bucket_id;
  ELSE
    UPDATE storage.buckets
       SET public = true,
           file_size_limit = 5242880,
           allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp']::text[]
     WHERE id = 'portfolio-public';
  END IF;
END
$$;

-- Remove only portfolio-public policies that may exist from earlier drafts.
-- Do not remove portfolio-documents policies or policies belonging to other features.
DROP POLICY IF EXISTS "portfolio-public_read_public" ON storage.objects;
DROP POLICY IF EXISTS "portfolio-public_select_public" ON storage.objects;
DROP POLICY IF EXISTS "portfolio-public_no_direct_write" ON storage.objects;
DROP POLICY IF EXISTS "portfolio-public_admin_manage" ON storage.objects;
DROP POLICY IF EXISTS "portfolio-public_admin_write" ON storage.objects;
DROP POLICY IF EXISTS "portfolio-public_insert_admin" ON storage.objects;
DROP POLICY IF EXISTS "portfolio-public_update_admin" ON storage.objects;
DROP POLICY IF EXISTS "portfolio-public_delete_admin" ON storage.objects;

-- Public image reads.
-- PostgreSQL RLS policies are permissive by default: any matching policy grants access.
-- This policy allows SELECT for portfolio-public bucket only.
CREATE POLICY "portfolio-public_select_public"
ON storage.objects
FOR SELECT
USING (bucket_id = 'portfolio-public');

-- Admin-only object creation. WITH CHECK prevents another bucket target.
-- No USING clause needed for INSERT (row doesn't exist yet).
CREATE POLICY "portfolio-public_insert_admin"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'portfolio-public'
  AND public.is_admin()
);

-- Admin-only object update. Both USING and WITH CHECK constrain bucket and admin status.
-- USING: applies to existing row (old values).
-- WITH CHECK: applies to new row (updated values).
-- This prevents non-admin updates and prevents moving objects to other buckets.
CREATE POLICY "portfolio-public_update_admin"
ON storage.objects
FOR UPDATE
USING (
  bucket_id = 'portfolio-public'
  AND public.is_admin()
)
WITH CHECK (
  bucket_id = 'portfolio-public'
  AND public.is_admin()
);

-- Admin-only object deletion.
CREATE POLICY "portfolio-public_delete_admin"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'portfolio-public'
  AND public.is_admin()
);
