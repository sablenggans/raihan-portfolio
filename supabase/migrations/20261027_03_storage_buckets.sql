-- =====================================================
-- Phase 3: Storage Buckets and Initial Policies
-- Creates buckets and sets up initial access policies
-- =====================================================

-- =====================================================
-- Bucket: portfolio-public
-- Purpose: Publicly accessible assets (profile images, project thumbnails, skill icons, certificate covers)
-- Policy: Public SELECT; admin Edge Functions INSERT/UPDATE via signed URLs
-- =====================================================
-- Note: The actual bucket is created via the Supabase Dashboard or CLI.
-- This migration sets the policies assuming the bucket exists.
-- Using raw SQL to set bucket policy via storage.buckets table

-- Mark bucket as public (managed via Supabase Dashboard UI or API)
-- We set a comment for documentation; Supabase manages the is_public flag

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  '00000000-0000-0000-0000-000000000001', -- placeholder UUID; actual bucket created separately
  'portfolio-public',
  true,
  5242880, -- 5MB limit
  '["image/jpeg","image/png","image/webp"]'
)
ON CONFLICT (id) DO NOTHING;

-- Set up storage policy: public can read objects in portfolio-public bucket
CREATE POLICY "portfolio-public_read_public" ON storage.objects
FOR SELECT USING (bucket_id = 'portfolio-public');

-- Admin Edge Functions will handle INSERT/UPDATE/DELETE via signed URLs
-- The policy below blocks direct anon writes
CREATE POLICY "portfolio-public_no_direct_write" ON storage.objects
FOR ALL USING (false);

-- =====================================================
-- Bucket: portfolio-documents
-- Purpose: Private documents (CV PDFs, certificate PDF files)
-- Policy: No public access; admin/signed URLs only
-- =====================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  '00000000-0000-0000-0000-000000000002',
  'portfolio-documents',
  false,
  10485760, -- 10MB limit
  '["application/pdf"]'
)
ON CONFLICT (id) DO NOTHING;

-- No public read access on portfolio-documents
CREATE POLICY "portfolio-documents_no_public_read" ON storage.objects
FOR SELECT USING (false);

-- Only admin functions can manage objects; block direct writes from anon
CREATE POLICY "portfolio-documents_no_direct_write" ON storage.objects
FOR ALL USING (false);

-- =====================================================
-- Policy: allow admin Edge Functions to manage portfolio-documents
-- This is a marker; actual enforcement happens in Edge Function logic
-- =====================================================
CREATE POLICY "portfolio-documents_admin_manage" ON storage.objects
FOR ALL USING (false) -- RLS bypassed when using service_role key
WITH CHECK (false);

-- =====================================================
-- End of storage bucket migration
-- =====================================================
-- Reminder: After running this migration, use Supabase Dashboard
-- or `supabase storage create` to create the actual buckets,
-- then re-run this migration or adjust bucket IDs accordingly.
-- =====================================================