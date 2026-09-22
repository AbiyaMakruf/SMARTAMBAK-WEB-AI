import { NextRequest, NextResponse } from "next/server";

const ADMIN_PASSWORD = "Abiyajr11";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { password } = body;

    if (!password || password !== ADMIN_PASSWORD) {
      return NextResponse.json(
        { error: "Kata sandi admin salah! Akses ditolak." },
        { status: 401 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Verifikasi admin berhasil.",
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Terjadi kesalahan internal pada server." },
      { status: 500 }
    );
  }
}
