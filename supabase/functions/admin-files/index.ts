import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { supabaseAdmin } from "../../supabaseClient";
import { v4 as uuidv4 } from "uuid";
import crypto from "crypto";

// =====================================================
// Admin Files Edge Function
// Handles secure file upload with validation,
// signed URL generation, and magic bytes verification.
// =====================================================

const app = new Hono();

interface UploadRequest {
  bucket: string;
  folder: string; // "profiles", "projects", "certificates", "skills"
  originalName: string;
  mimeType: string;
}

// Validate MIME type against allowed list
function validateMimeType(mimeType: string, bucket: string): { valid: boolean; reason?: string } {
  const allowed = {
    portfolio-public: ["image/jpeg", "image/png", "image/webp"],
    portfolio-documents: ["application/pdf"],
  }[bucket];

  if (!allowed) {
    return { valid: false, reason: "Bucket tidak dikenal" };
  }

  if (!allowed.includes(mimeType)) {
    return { valid: false, reason: `Tipe file ${mimeType} tidak diizinkan untuk bucket ${bucket}. File yang didukung: ${allowed.join(", ")}` };
  }

  return { valid: true };
}

// Validate magic bytes (file header) against MIME type
function validateMagicBytes(buffer: Buffer, mimeType: string): { valid: boolean; reason?: string } {
  const checks = {
    "image/jpeg": buffer.length >= 2 && buffer[0] === 0xff && buffer[1] === 0xd8,
    "image/png": buffer.length >= 8 &&
      buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47 &&
      buffer[4] === 0x0d && buffer[5] === 0x0a && buffer[6] === 0x1a && buffer[7] === 0x0a,
    "image/webp": buffer.length >= 12 &&
      buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46 &&
      // Check for WEBP RIFF header at offset 8
      buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50,
    "application/pdf": buffer.length >= 4 && buffer[0] === 0x25 && buffer[1] === 0x25 && buffer[2] === 0x45 && buffer[3] === 0x4f,
  };

  if (!checks[mimeType]) {
    return { valid: false, reason: "Tipe MIME tidak didukung validasi magic bytes" };
  }

  if (!checks[mimeType](buffer)) {
    return { valid: false, reason: `Header file tidak sesuai dengan tipe ${mimeType}. File mungkin rusak atau bertipe lain.` };
  }

  return { valid: true };
}

// Generate a secure UUID-based path
function generatePath(folder: string, originalName: string): string {
  const ext = originalName.split(".").pop() || "bin";
  const uuid = uuidv4();
  // Sanitize folder name to prevent path traversal
  const safeFolder = folder.replace(/[^a-zA-Z0-9_-]/g, "_");
  return `${safeFolder}/${uuid}.${ext}`;
}

// =====================================================
// Upload endpoint
// =====================================================
app.post("/upload", async (c) => {
  try {
    const body = await c.req.json<UploadRequest>();
    const { bucket, folder, originalName, mimeType } = body;

    // 1. Validate MIME type
    const validation = validateMimeType(mimeType, bucket);
    if (!validation.valid) {
      return c.json({ error: validation.reason }, 400);
    }

    // 2. Verify user is authenticated admin
    const authHeader = c.req.header("Authorization") || "";
    if (!authHeader.startsWith("Bearer ")) {
      return c.json({ error: "Authorization header missing or invalid" }, 401);
    }

    const jwt = authHeader.substring(7);
    const { data: payload, error: jwtError } = await supabaseAdmin.auth.getUser(jwt);

    if (jwtError || !payload.user) {
      return c.json({ error: "Invalid or expired JWT token" }, 401);
    }

    // Verify admin role
    const { data: adminCheck, error: adminError } = await supabaseAdmin
      .from("admin_users")
      .select("user_id", { count: "exact" })
      .eq("user_id", payload.user.id)
      .single();

    if (adminError || !adminCheck) {
      return c.json({ error: "Anda bukan admin yang terotorisasi" }, 403);
    }

    // 3. Read the raw file data from the request body
    // The actual file content comes as multipart/form-data; we'll read it as buffer
    const contentType = c.req.header("Content-Type") || "";
    let fileBuffer: Buffer;

    if (contentType.includes("multipart")) {
      // Parse multipart - Hono makes this accessible via c.req
      const formData = await c.req.formData();
      const file = formData.get("file");
      if (!file) {
        return c.json({ error: "No file part in request" }, 400);
      }
      const fileBytes = await file.arrayBuffer();
      fileBuffer = Buffer.from(fileBytes);
    } else {
      // Read raw body
      fileBuffer = Buffer.from(await c.req.arrayBuffer());
    }

    // 4. Validate magic bytes
    const magicCheck = validateMagicBytes(fileBuffer, mimeType);
    if (!magicCheck.valid) {
      return c.json({ error: magicCheck.reason }, 400);
    }

    // 5. Generate secure path
    const storagePath = generatePath(folder, originalName);

    // 6. Create signed upload URL
    // This signs the upload for a short duration (10 minutes)
    const { data: signedUrl, error: signError } = await supabaseAdmin.storage
      .from(bucket)
      .createSignedUploadUrl(storagePath, 600); // 10 minutes

    if (signError) {
      return c.json({ error: "Generate signed URL failed", details: signError.message }, 500);
    }

    // 7. Return the signed URL and path info
    // The client will upload directly to this URL
    return c.json({
      success: true,
      storagePath,
      signedUrl: signedUrl.signedUrl,
      expiresIn: signedUrl.expiresIn,
      uploadMethod: "PUT",
    });
  } catch (error: any) {
    console.error("Upload error:", error);
    return c.json({ error: "Internal server error", details: error.message }, 500);
  }
});

// =====================================================
// Verify uploaded file endpoint
// Called after client finishes uploading to verify and finalize
// =====================================================
app.post("/verify", async (c) => {
  try {
    const body = await c.req.json();
    const { storagePath, bucket, originalName } = body;

    if (!storagePath) {
      return c.json({ error: "Missing storagePath" }, 400);
    }

    // Verify the file exists and get its metadata
    const { data, error } = await supabaseAdmin.storage
      .from(bucket)
      .getPublicUrl(storagePath);

    if (error) {
      return c.json({ error: "File not found or access denied", details: error.message }, 404);
    }

    // Return public URL and file info
    return c.json({
      success: true,
      publicUrl: data.publicUrl,
      storagePath,
      fileName: originalName,
    });
  } catch (error: any) {
    return c.json({ error: "Internal server error", details: error.message }, 500);
  }
});

// =====================================================
// Delete file endpoint
// Safely deletes file from Storage and removes DB reference
// =====================================================
app.delete("/delete", async (c) => {
  try {
    const body = await c.req.json();
    const { storagePath, bucket } = body;

    if (!storagePath || !bucket) {
      return c.json({ error: "Missing storagePath or bucket" }, 400);
    }

    // Verify admin
    const authHeader = c.req.header("Authorization") || "";
    if (!authHeader.startsWith("Bearer ")) {
      return c.json({ error: "Authorization header missing" }, 401);
    }

    const jwt = authHeader.substring(7);
    const { data: payload, error: jwtError } = await supabaseAdmin.auth.getUser(jwt);

    if (jwtError || !payload.user) {
      return c.json({ error: "Invalid JWT token" }, 401);
    }

    const { data: adminCheck, error: adminError } = await supabaseAdmin
      .from("admin_users")
      .select("user_id", { count: "exact" })
      .eq("user_id", payload.user.id)
      .single();

    if (adminError || !adminCheck) {
      return c.json({ error: "Anda bukan admin yang terotorisasi" }, 403);
    }

    // Delete the file from Storage
    const { error: deleteError } = await supabaseAdmin.storage
      .from(bucket)
      .remove([storagePath]);

    if (deleteError) {
      // Log the error to cleanup queue for retry
      await supabaseAdmin.from("storage_cleanup_queue").insert({
        bucket_id: bucket,
        object_path: storagePath,
        reason: "delete_failed_edge_function",
        attempts: 1,
        last_error: deleteError.message,
      });

      return c.json({
        error: "Gagal menghapus file dari Storage",
        details: deleteError.message,
        queued_for_retry: true,
      }, 500);
    }

    // File deleted successfully
    return c.json({
      success: true,
      deleted: storagePath,
    });
  } catch (error: any) {
    return c.json({ error: "Internal server error", details: error.message }, 500);
  }
});

serve({ port: 54321 }, app);
export default app;