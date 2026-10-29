import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { supabaseAdmin } from "../../supabaseClient";
import { v4 as uuidv4 } from "uuid";

// =====================================================
// Public Document Edge Function
// Provides signed URLs for private CV and certificate files
// with short expiry and content-disposition for download
// =====================================================

const app = new Hono();

// =====================================================
// Get signed URL for CV download
// Only accessible if this CV is the active one linked to site_settings
// =====================================================
app.get("/cv-download", async (c) => {
  try {
    const { storagePath, originalFileName } = await c.req.query();

    if (!storagePath || !originalFileName) {
      return c.json({ error: "Missing parameters: storagePath and originalFileName required" }, 400);
    }

    // Verify the CV is the active one by checking site_settings
    const { data: settings, error: settingsError } = await supabaseAdmin
      .from("site_settings")
      .select("active_cv_id")
      .single();

    if (settingsError || !settings) {
      return c.json({ error: "Could not verify settings" }, 500);
    }

    // Check if the requested CV is the active one
    if (settings.active_cv_id !== storagePath) {
      return c.json({ error: "CV ini bukan CV aktif yang dipublikasikan" }, 403);
    }

    // Verify the file exists in storage
    const { error: storageError } = await supabaseAdmin.storage
      .from("portfolio-documents")
      .getPublicUrl(storagePath);

    if (storageError) {
      return c.json({ error: "File CV tidak ditemukan di Storage" }, 404);
    }

    // Create signed URL with content-disposition for download
    const { data: signedData, error: signError } = await supabaseAdmin.storage
      .from("portfolio-documents")
      .createSignedUrl(storagePath, 300); // 5 minutes expiry

    if (signError) {
      return c.json({ error: "Generate signed URL failed", details: signError.message }, 500);
    }

    // Return signed URL with original filename for download
    return c.json({
      success: true,
      signedUrl: signedData signedUrl,
      expiresIn: signedData expiresIn,
      fileName: originalFileName,
      contentDisposition: `attachment; filename="${originalFileName}"`,
    });
  } catch (error: any) {
    return c.json({ error: "Internal server error", details: error.message }, 500);
  }
});

// =====================================================
// Get signed URL for certificate file download
// Verifies the certificate file path matches database record
// =====================================================
app.get("/certificate-download", async (c) => {
  try {
    const { storagePath, certificateId, originalFileName } = await c.req.query();

    if (!storagePath || !certificateId || !originalFileName) {
      return c.json({ error: "Missing parameters: storagePath, certificateId, originalFileName required" }, 400);
    }

    // Verify the certificate exists and get its record
    const { data: cert, error: certError } = await supabaseAdmin
      .from("certificates")
      .select("file_path, title, is_public")
      .eq("id", certificateId)
      .single();

    if (certError || !cert) {
      return c.json({ error: "Sertifikat tidak ditemukan" }, 404);
    }

    // Verify the file path matches
    if (cert.file_path !== storagePath) {
      return c.json({ error: "Path file sertifikat tidak cocok" }, 403);
    }

    // Verify file exists
    const { error: storageError } = await supabaseAdmin.storage
      .from("portfolio-documents")
      .getPublicUrl(storagePath);

    if (storageError) {
      return c.json({ error: "File sertifikat tidak ditemukan di Storage" }, 404);
    }

    // Create signed URL
    const { data: signedData, error: signError } = await supabaseAdmin.storage
      .from("portfolio-documents")
      .createSignedUrl(storagePath, 300); // 5 minutes

    if (signError) {
      return c.json({ error: "Generate signed URL failed", details: signError.message }, 500);
    }

    return c.json({
      success: true,
      signedUrl: signedData signedUrl,
      expiresIn: signedData expiresIn,
      fileName: originalFileName,
      certificateTitle: cert.title,
      contentDisposition: `attachment; filename="${originalFileName}"`,
    });
  } catch (error: any) {
    return c.json({ error: "Internal server error", details: error.message }, 500);
  }
});

// =====================================================
// Health check endpoint
// =====================================================
app.get("/health", (c) => {
  return c.json({ status: "ok", service: "public-documents" });
});

serve({ port: 54322 }, app);
export default app;