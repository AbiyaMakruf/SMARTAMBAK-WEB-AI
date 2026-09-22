import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin, supabase, STORAGE_BUCKET } from "@/lib/supabase";

const ADMIN_PASSWORD = "Abiyajr11";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, password } = body;

    if (!password || password !== ADMIN_PASSWORD) {
      return NextResponse.json(
        { error: "Kata sandi admin tidak valid! Akses ditolak." },
        { status: 401 }
      );
    }

    if (!id) {
      return NextResponse.json(
        { error: "ID rekam data wajib disertakan." },
        { status: 400 }
      );
    }

    const admin = getSupabaseAdmin();

    // 1. Fetch record first to get image_url if we want to clean up storage
    let imageUrlToDelete: string | null = null;
    const { data: existingRecord } = await admin
      .from("shrimp_predictions")
      .select("image_url")
      .eq("id", id)
      .single();

    if (existingRecord?.image_url) {
      imageUrlToDelete = existingRecord.image_url;
    }

    // 2. Delete the record from the database
    const { error: dbError } = await admin
      .from("shrimp_predictions")
      .delete()
      .eq("id", id);

    if (dbError) {
      console.error("Admin DB delete single error:", dbError);
      // Fallback try with regular supabase client
      const { error: clientError } = await supabase
        .from("shrimp_predictions")
        .delete()
        .eq("id", id);

      if (clientError) {
        return NextResponse.json(
          { error: `Gagal menghapus data dari database: ${clientError.message}` },
          { status: 500 }
        );
      }
    }

    // 3. Attempt to delete storage file if path can be extracted
    if (imageUrlToDelete) {
      try {
        const urlParts = imageUrlToDelete.split(`/${STORAGE_BUCKET}/`);
        if (urlParts.length > 1) {
          const filePath = decodeURIComponent(urlParts[1].split("?")[0]);
          await admin.storage.from(STORAGE_BUCKET).remove([filePath]);
        }
      } catch (storageErr) {
        console.warn("Storage delete non-critical error:", storageErr);
      }
    }

    return NextResponse.json({
      success: true,
      message: "Rekam data sampel berhasil dihapus.",
    });
  } catch (err: any) {
    console.error("Delete single API error:", err);
    return NextResponse.json(
      { error: err.message || "Terjadi kesalahan internal pada server." },
      { status: 500 }
    );
  }
}
