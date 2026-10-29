-- =====================================================
-- Phase 4: Admin Users RLS Policy
-- Allow authenticated users to check their own admin status
-- =====================================================

-- Enable RLS on admin_users table
ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;

-- Policy: authenticated users can read only their own row in admin_users
-- This allows checkAdminStatus() and public.is_admin() to work correctly:
--   - Admin users can see their own row -> is_admin() returns true
--   - Non-admin users see no rows -> is_admin() returns false
--   - Non-admin users cannot enumerate who is admin
CREATE POLICY "admin_users_authenticated_read" ON public.admin_users
FOR SELECT USING (user_id = auth.uid());

-- Only service_role can insert/update/delete admin_users (via Supabase Dashboard)
-- No policy needed for INSERT/UPDATE/DELETE since service_role bypasses RLS
