/**
 * =====================================================
 * Supabase Client Configuration
 *
 * Isi VITE_SUPABASE_URL dan VITE_SUPABASE_ANON_KEY setelah
 * project Supabase dibuat. Jangan pernah menyematkan service_role
 * key di file ini atau di bundle frontend.
 * =====================================================
 */

let publicClient = null;

// Temporary auth diagnostics: log presence and configuration relationships only;
// never log session values, tokens, keys, or user data.
function getAuthDiagnosticState(client) {
  const storageKey = client?.storageKey;
  let storedAuthStorageKeys = null;

  try {
    if (typeof localStorage !== "undefined") {
      // Auth storage key names are metadata only; never read or log their values.
      storedAuthStorageKeys = Object.keys(localStorage).filter((key) => /^sb-.+-auth-token$/.test(key));
    }
  } catch {
    // Storage may be unavailable in restricted browser contexts.
  }

  return {
    clientStorageKey: storageKey ?? null,
    storedAuthStorageKeys,
    clientStorageKeyPresent: storedAuthStorageKeys?.includes(storageKey) ?? null,
    clientStorageKeyMatchesStoredAuthKey: storedAuthStorageKeys
      ? storedAuthStorageKeys.includes(storageKey)
      : null,
  };
}

/**
 * Return the client that was created by initSupabase(), if any.
 */
export function getSupabaseClient() {
  return publicClient;
}

/**
 * Create (once) and return the public Supabase client.
 * Returns null when the environment variables are not configured, so the
 * rest of the site/admin page can keep working instead of crashing.
 */
export async function initSupabase() {
  if (publicClient) return publicClient;

  const url = import.meta.env.VITE_SUPABASE_URL;
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

  if (!url || !key) {
    console.warn("[Supabase] Environment variables not set. Supabase features are disabled.");
    return null;
  }

  const { createClient } = await import("@supabase/supabase-js");
  publicClient = createClient(url, key);

  // Keep a reference for scripts that expect the legacy global.
  window.supabase = publicClient;
  window.supabasePublic = publicClient;

  // Temporary diagnostic for session removals originating inside Supabase Auth.
  publicClient.auth.onAuthStateChange((event, session) => {
    console.info("[Auth diagnostic] Auth state changed", {
      event,
      sessionAvailable: Boolean(session),
      ...getAuthDiagnosticState(publicClient),
    });
  });

  return publicClient;
}

/**
 * Check whether the current authenticated user is listed in admin_users.
 * The client is passed explicitly when available, otherwise the shared
 * public client is used.
 */
export async function checkAdminStatus(client) {
  const supabase = client || publicClient;
  if (!supabase) {
    return { isAuthenticated: false, isAdmin: false, error: null };
  }

  console.info("[Auth diagnostic] Before getSession", {
    ...getAuthDiagnosticState(supabase),
  });

  let session;
  try {
    const { data, error } = await supabase.auth.getSession();
    session = data?.session;
    console.info("[Auth diagnostic] After getSession", {
      sessionAvailable: Boolean(session),
      sessionExpiresAt: session?.expires_at ?? null,
      sessionExpiresIn: session?.expires_in ?? null,
      hasAccessToken: Boolean(session?.access_token),
      hasRefreshToken: Boolean(session?.refresh_token),
      errorStatus: error?.status ?? null,
      errorName: error?.name ?? null,
      ...getAuthDiagnosticState(supabase),
    });
  } catch (err) {
    console.info("[Auth diagnostic] getSession threw", {
      errorStatus: err?.status ?? null,
      errorName: err?.name ?? null,
      ...getAuthDiagnosticState(supabase),
    });
    console.warn("[Supabase] Could not restore session:", err?.message || err);
    return { isAuthenticated: false, isAdmin: false, error: err };
  }
  if (!session) {
    console.info("[Auth diagnostic] No session found, returning isAuthenticated=false");
    return { isAuthenticated: false, isAdmin: false, error: null };
  }

  // Validasi user ke server. Panggil getUser() tanpa parameter agar Supabase
  // dapat auto-refresh access token jika expired menggunakan refresh token.
  // Jangan anggap gangguan jaringan sebagai sesi tidak valid.
  let userData;
  let userError;
  try {
    ({ data: userData, error: userError } = await supabase.auth.getUser());
    console.info("[Auth diagnostic] getUser result", {
      userReturned: Boolean(userData?.user),
      userUID: userData?.user?.id ?? null,
      errorStatus: userError?.status ?? null,
      errorName: userError?.name ?? null,
      errorMessage: userError?.message ?? null,
    });
  } catch (err) {
    console.info("[Auth diagnostic] getUser threw", {
      errorStatus: err?.status ?? null,
      errorName: err?.name ?? null,
      errorMessage: err?.message ?? null,
    });
    console.warn("[Supabase] Could not validate stored session:", err?.message || err);
    return { isAuthenticated: true, isAdmin: false, error: err };
  }

  if (userError) {
    console.warn("[Supabase] Could not validate stored session:", userError.message);
    // Hanya hapus sesi jika server menolak dengan 401/403 (sesi tidak valid).
    // Error jaringan, rate‑limit, atau server error tidak menghapus sesi lokal.
    if (userError.status === 401 || userError.status === 403) {
      console.info("[Auth diagnostic] signOut called", { source: "checkAdminStatus: getUser rejected session (401/403)" });
      try {
        await supabase.auth.signOut();
      } catch {
        /* abaikan kesalahan signOut */
      }
      return { isAuthenticated: false, isAdmin: false, error: userError };
    }
    // Error lain: anggap sesi masih valid, tetapi admin status tidak bisa diperiksa.
    console.info("[Auth diagnostic] getUser error ignored (not 401/403), returning isAuthenticated=true");
    return { isAuthenticated: true, isAdmin: false, error: userError };
  }

  if (!userData?.user) {
    const error = new Error("Sesi tersimpan tidak valid");
    console.info("[Auth diagnostic] signOut called", { source: "checkAdminStatus: getUser returned no user" });
    try {
      await supabase.auth.signOut();
    } catch {
      /* abaikan kesalahan signOut */
    }
    return { isAuthenticated: false, isAdmin: false, error };
  }

  try {
    const userId = userData.user.id;
    console.info("[Auth diagnostic] admin_users query: searching for user_id", { userId });
    const { data: adminCheck, error } = await supabase
      .from("admin_users")
      .select("user_id")
      .eq("user_id", userId)
      .maybeSingle();

    if (error) {
      console.warn("[Supabase] Could not verify admin status:", error.message);
      console.info("[Auth diagnostic] admin_users query error, returning isAuthenticated=true, isAdmin=false");
      return { isAuthenticated: true, isAdmin: false, error };
    }

    const isAdmin = Boolean(adminCheck);
    console.info("[Auth diagnostic] admin_users query result", {
      userFound: isAdmin,
      queryUserId: userId,
      returnedRow: adminCheck ?? null,
    });
    return { isAuthenticated: true, isAdmin, error: null };
  } catch (error) {
    console.warn("[Supabase] Could not verify admin status:", error?.message || error);
    console.info("[Auth diagnostic] admin_users query threw, returning isAuthenticated=true, isAdmin=false");
    return { isAuthenticated: true, isAdmin: false, error };
  }
}
