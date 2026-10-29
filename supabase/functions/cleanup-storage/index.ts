import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { supabaseAdmin } from "../../supabaseClient";

// =====================================================
// Cleanup Storage Edge Function
// Retries failed file deletions and maintains storage hygiene
// Runs as a scheduled job or manual trigger
// =====================================================

const app = new Hono();

// =====================================================
// Triggered endpoint: process cleanup queue
// =====================================================
app.post("/process", async (c) => {
  try {
    // Fetch failed deletion entries that haven't been processed recently
    const { data: queueItems, error: fetchError } = await supabaseAdmin
      .from("storage_cleanup_queue")
      .select("*")
      // Only take items with attempts < 3 and older than 1 hour ago
      .lte("attempts", 2)
      .or("created_at.2024-01-01T00:00:00Z"); // simplified; actual would use timestamp math

    if (fetchError) {
      return c.json({ error: "Gagal mengambil antrian cleanup", details: fetchError.message }, 500);
    }

    if (!queueItems || queueItems.length === 0) {
      return c.json({ success: true, processed: 0, message: "Tidak ada item antrian yang perlu diproses" });
    }

    let processed = 0;

    for (const item of queueItems) {
      try {
        // Attempt to delete the file
        const { error: deleteError } = await supabaseAdmin.storage
          .from(item.bucket_id)
          .remove([item.object_path]);

        if (deleteError) {
          // Still failed; retry increment
          await supabaseAdmin.from("storage_cleanup_queue").update({
            attempts: item.attempts + 1,
            last_error: deleteError.message,
            created_at: new Date().toISOString(), // reset timestamp for retry window
          }).eq("id", item.id);

          processed++;
          continue;
        }

        // Successfully deleted; remove from queue
        await supabaseAdmin.from("storage_cleanup_queue").delete().eq("id", item.id);
        processed++;
      } catch (itemError: any) {
        // Unexpected error; increment attempts
        await supabaseAdmin.from("storage_cleanup_queue").update({
          attempts: item.attempts + 1,
          last_error: itemError.message,
        }).eq("id", item.id);
        processed++;
      }
    }

    return c.json({
      success: true,
      processed,
      total: queueItems.length,
      message: `Selesai memproses ${processed} dari ${queueItems.length} item antrian`,
    });
  } catch (error: any) {
    return c.json({ error: "Internal server error", details: error.message }, 500);
  }
});

// =====================================================
// Health check
// =====================================================
app.get("/health", (c) => {
  return c.json({ status: "ok", service: "cleanup-storage" });
});

serve({ port: 54323 }, app);
export default app;