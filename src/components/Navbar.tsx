"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Camera, BarChart3, Waves, ShieldCheck, Zap } from "lucide-react";

export function Header() {
  return (
    <header className="sticky top-0 z-40 w-full border-b border-cyan-900/40 bg-slate-950/80 backdrop-blur-md px-4 py-3">
      <div className="mx-auto flex max-w-lg items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-tr from-cyan-500 to-emerald-400 shadow-md shadow-cyan-500/20 text-slate-950 font-black">
            <Waves className="h-5 w-5 text-slate-950" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-slate-100 text-base leading-tight tracking-tight">
                Smart Ambak AI
              </span>
              <span className="rounded-full bg-cyan-500/20 px-1.5 py-0.2 text-[10px] font-semibold text-cyan-300 border border-cyan-500/30">
                v2.0
              </span>
            </div>
            <p className="text-[11px] text-slate-400">Deteksi & Validasi 3 Model AI</p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <div className="flex items-center gap-1 text-[11px] font-medium text-emerald-400 bg-emerald-950/60 border border-emerald-800/50 rounded-full px-2 py-0.5">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
            Cloud Run Ready
          </div>
        </div>
      </div>
    </header>
  );
}

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-slate-800 bg-slate-950/95 backdrop-blur-lg pb-safe">
      <div className="mx-auto flex max-w-lg items-center justify-around px-2 py-2">
        <Link
          href="/"
          className={`flex flex-col items-center gap-1 rounded-xl px-3 py-1.5 transition-all active:scale-95 ${
            pathname === "/"
              ? "text-cyan-400 font-semibold bg-cyan-950/40"
              : "text-slate-400 hover:text-slate-200"
          }`}
        >
          <Camera className="h-5 w-5" />
          <span className="text-[11px]">Deteksi AI</span>
        </Link>

        <Link
          href="/report"
          className={`flex flex-col items-center gap-1 rounded-xl px-3 py-1.5 transition-all active:scale-95 ${
            pathname === "/report"
              ? "text-cyan-400 font-semibold bg-cyan-950/40"
              : "text-slate-400 hover:text-slate-200"
          }`}
        >
          <BarChart3 className="h-5 w-5" />
          <span className="text-[11px]">Laporan & Log</span>
        </Link>

        <Link
          href="/admin/load-test"
          className={`flex flex-col items-center gap-1 rounded-xl px-3 py-1.5 transition-all active:scale-95 ${
            pathname?.startsWith("/admin")
              ? "text-amber-400 font-semibold bg-amber-950/40"
              : "text-slate-400 hover:text-slate-200"
          }`}
        >
          <Zap className="h-5 w-5" />
          <span className="text-[11px]">Uji Beban</span>
        </Link>
      </div>
    </nav>
  );
}
