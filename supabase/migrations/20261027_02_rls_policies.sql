-- =====================================================
-- Phase 2: Row Level Security (RLS) Policies
-- Applies to all user-facing tables
-- =====================================================

-- =====================================================
-- Enable RLS on all tables (except admin_users which is managed differently)
-- =====================================================
ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.resumes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.experiences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.certificates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.skills ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.storage_cleanup_queue DISABLE ROW LEVEL SECURITY; -- only service_role accesses this

-- =====================================================
-- Helper function: is_admin()
-- Used in policy checks. Returns true only for authenticated admin users.
-- =====================================================
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
STABLE
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.admin_users
    WHERE user_id = auth.uid()
  );
END;
$$;

-- =====================================================
-- site_settings policies
-- Anonymous/public can read; authenticated + admin can write/upsert
-- =====================================================
CREATE POLICY "site_settings_read_public" ON public.site_settings
FOR SELECT USING (true);

CREATE POLICY "site_settings_upsert_admin" ON public.site_settings
FOR ALL USING (public.is_admin())
WITH CHECK (public.is_admin());

-- =====================================================
-- resumes policies
-- Public can read only the active CV (via site_settings reference);
-- Admin can CRUD all resumes
-- =====================================================
CREATE POLICY "resumes_read_active" ON public.resumes
FOR SELECT USING (is_public = true);

-- Admin can do everything with resumes
CREATE POLICY "resumes_admin_full" ON public.resumes
FOR ALL USING (public.is_admin())
WITH CHECK (public.is_admin());

-- =====================================================
-- experiences policies
-- Public can read only public experiences;
-- Admin can CRUD all experiences
-- =====================================================
CREATE POLICY "experiences_read_public" ON public.experiences
FOR SELECT USING (is_public = true);

CREATE POLICY "experiences_admin_full" ON public.experiences
FOR ALL USING (public.is_admin())
WITH CHECK (public.is_admin());

-- =====================================================
-- projects policies
-- Public can read only public projects;
-- Admin can CRUD all projects
-- =====================================================
CREATE POLICY "projects_read_public" ON public.projects
FOR SELECT USING (is_public = true);

CREATE POLICY "projects_admin_full" ON public.projects
FOR ALL USING (public.is_admin())
WITH CHECK (public.is_admin());

-- =====================================================
-- certificates policies
-- Public can read only public certificates;
-- Admin can CRUD all certificates
-- =====================================================
CREATE POLICY "certificates_read_public" ON public.certificates
FOR SELECT USING (is_public = true);

CREATE POLICY "certificates_admin_full" ON public.certificates
FOR ALL USING (public.is_admin())
WITH CHECK (public.is_admin());

-- =====================================================
-- skills policies
-- Public can read only public skills;
-- Admin can CRUD all skills
-- =====================================================
CREATE POLICY "skills_read_public" ON public.skills
FOR SELECT USING (is_public = true);

CREATE POLICY "skills_admin_full" ON public.skills
FOR ALL USING (public.is_admin())
WITH CHECK (public.is_admin());

-- =====================================================
-- storage_cleanup_queue policies
-- Only service_role can access this table
-- =====================================================
CREATE POLICY "cleanup_service_role_only" ON public.storage_cleanup_queue
FOR ALL USING (false); -- no one via normal auth; service_role bypasses RLS

-- =====================================================
-- End of RLS policies
-- =====================================================