import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin, supabase, STORAGE_BUCKET } from "@/lib/supabase";

const RESET_PASSWORD = "Abiyajr11";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { password } = body;

    if (!password || password !== RESET_PASSWORD) {
      return NextResponse.json(
        { error: "Password reset salah! Akses ditolak." },
        { status: 401 }
      );
    }

    // Use admin client (bypasses RLS)
    const admin = getSupabaseAdmin();

    // Delete all records from shrimp_predictions
    // In PostgREST, delete requires a filter; using neq id dummy UUID deletes all rows
    const { error: dbError } = await admin
      .from("shrimp_predictions")
      .delete()
      .neq("id", "00000000-0000-0000-0000-000000000000");

    if (dbError) {
      console.error("Admin DB delete error:", dbError);
      // Fallback try with regular supabase client
      const { error: clientError } = await supabase
        .from("shrimp_predictions")
        .delete()
        .neq("id", "00000000-0000-0000-0000-000000000000");

      if (clientError) {
        return NextResponse.json(
          { error: `Gagal mereset database: ${clientError.message}` },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({
      success: true,
      message: "Seluruh data riwayat dan evaluasi berhasil direset.",
    });
  } catch (err: any) {
    console.error("Reset API error:", err);
    return NextResponse.json(
      { error: err.message || "Terjadi kesalahan internal pada server." },
      { status: 500 }
    );
  }
}
