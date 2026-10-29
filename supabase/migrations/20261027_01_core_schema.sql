-- =====================================================
-- Phase 1: Core Schema Migration
-- Creates all tables, constraints, indexes, and triggers
-- =====================================================

-- Extensions
-- uuid-ossl removed: not available in Supabase; PostgreSQL 13+ has gen_random_uuid() built-in
-- pgjwt removed: not used in this migration or related functions

-- =====================================================
-- Table: admin_users
-- Stores admin users linked to auth.users
-- Only populated manually via Supabase Dashboard
-- =====================================================
CREATE TABLE IF NOT EXISTS public.admin_users (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id)
);

-- =====================================================
-- Table: resumes
-- Stores CV/Resume documents
-- Created before site_settings to satisfy foreign key reference
-- =====================================================
CREATE TABLE IF NOT EXISTS public.resumes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  storage_path TEXT UNIQUE NOT NULL,
  original_file_name TEXT NOT NULL,
  mime_type TEXT NOT NULL CHECK (mime_type = 'application/pdf'),
  size_bytes BIGINT NOT NULL CHECK (size_bytes > 0 AND size_bytes <= 10485760), -- max 10MB
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- =====================================================
-- Table: site_settings
-- Singleton table for homepage/profile settings
-- References resumes(id) for active_cv_id
-- =====================================================
CREATE TABLE IF NOT EXISTS public.site_settings (
  id SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  full_name TEXT NOT NULL,
  headline TEXT,
  intro TEXT,
  about_paragraphs TEXT[] DEFAULT '{}',
  location TEXT,
  email TEXT,
  github_url TEXT,
  linkedin_url TEXT,
  profile_image_path TEXT,
  profile_image_alt TEXT,
  active_cv_id UUID REFERENCES public.resumes(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(id)
);

-- =====================================================
-- Trigger function: auto-update updated_at
-- =====================================================
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- Triggers (idempotent: safe to re-run)
-- =====================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'handle_site_settings_updated') THEN
    CREATE TRIGGER handle_site_settings_updated
    BEFORE UPDATE ON public.site_settings
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'handle_resumes_updated') THEN
    CREATE TRIGGER handle_resumes_updated
    BEFORE UPDATE ON public.resumes
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
  END IF;
END
$$;

-- =====================================================
-- Table: experiences
-- Stores work experience entries
-- =====================================================
CREATE TABLE IF NOT EXISTS public.experiences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL CHECK (type IN ('Employment','Internship','Freelance','Business','Project')),
  title TEXT NOT NULL,
  company TEXT NOT NULL,
  period TEXT,
  description TEXT,
  highlights TEXT[] DEFAULT '{}',
  sort_order INTEGER NOT NULL DEFAULT 0 CHECK (sort_order >= 0),
  is_public BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- =====================================================
-- Trigger: experiences updated_at
-- =====================================================
CREATE TRIGGER handle_experiences_updated
BEFORE UPDATE ON public.experiences
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- =====================================================
-- Index: experiences sort + recency
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_experiences_sort_public ON public.experiences(sort_order, created_at DESC);

-- =====================================================
-- Table: projects
-- Stores project portfolio entries
-- =====================================================
CREATE TABLE IF NOT EXISTS public.projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  category TEXT,
  role TEXT,
  image_path TEXT,
  tech TEXT[] DEFAULT '{}',
  demo_url TEXT CHECK (demo_url IS NULL OR (demo_url ~* '^https?://')),
  repo_url TEXT CHECK (repo_url IS NULL OR (repo_url ~* '^https?://')),
  sort_order INTEGER NOT NULL DEFAULT 0 CHECK (sort_order >= 0),
  is_public BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- =====================================================
-- Trigger: projects updated_at
-- =====================================================
CREATE TRIGGER handle_projects_updated
BEFORE UPDATE ON public.projects
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- =====================================================
-- Index: projects sort + recency
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_projects_sort_public ON public.projects(sort_order, created_at DESC);

-- =====================================================
-- Table: certificates
-- Stores certificate entries
-- =====================================================
CREATE TABLE IF NOT EXISTS public.certificates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  issuer TEXT,
  issued_on DATE,
  validity_note TEXT,
  image_path TEXT,
  file_path TEXT,
  verification_url TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0 CHECK (sort_order >= 0),
  is_public BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- =====================================================
-- Trigger: certificates updated_at
-- =====================================================
CREATE TRIGGER handle_certificates_updated
BEFORE UPDATE ON public.certificates
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- =====================================================
-- Index: certificates sort + recency
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_certificates_sort_public ON public.certificates(sort_order, created_at DESC);

-- =====================================================
-- Table: skills
-- Stores skill entries with category
-- =====================================================
CREATE TABLE IF NOT EXISTS public.skills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  icon_path TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0 CHECK (sort_order >= 0),
  is_public BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- =====================================================
-- Trigger: skills updated_at
-- =====================================================
CREATE TRIGGER handle_skills_updated
BEFORE UPDATE ON public.skills
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- =====================================================
-- Index: skills sort + recency
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_skills_sort_public ON public.skills(sort_order, created_at DESC);

-- =====================================================
-- Table: storage_cleanup_queue
-- Internal queue for retrying failed file deletions
-- =====================================================
CREATE TABLE IF NOT EXISTS public.storage_cleanup_queue (
  id BIGSERIAL PRIMARY KEY,
  bucket_id TEXT NOT NULL,
  object_path TEXT NOT NULL,
  reason TEXT,
  attempts INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  processed_at TIMESTAMPTZ
);

-- =====================================================
-- Unique constraint: prevent duplicate queue entries
-- =====================================================
CREATE UNIQUE INDEX IF NOT EXISTS idx_cleanup_queue_unique ON public.storage_cleanup_queue(bucket_id, object_path);

-- =====================================================
-- End of migration
-- =====================================================