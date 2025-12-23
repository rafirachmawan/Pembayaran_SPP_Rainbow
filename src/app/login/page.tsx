"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const router = useRouter();

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setLoading(true);

    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });

    const data = await res.json().catch(() => ({}));
    setLoading(false);

    if (!res.ok) return setErr(data?.error || "Login gagal");
    router.push(data.role === "SUPER_ADMIN" ? "/admin" : "/siswa");
  }

  return (
    <div
      className="container"
      style={{ minHeight: "100vh", display: "grid", placeItems: "center" }}
    >
      <div className="card" style={{ width: "min(460px, 92vw)" }}>
        <div className="brand">
          <div className="logo" />
          <div className="brandTitle">
            <b>SPP Rainbow</b>
            <span>Portal Siswa & Super Admin</span>
          </div>
        </div>

        <div className="hr" />

        <h1 className="h1">Masuk</h1>
        <p className="p">
          Siswa login pakai <b>NIS</b>. Super admin pakai akun admin.
        </p>

        <form onSubmit={onSubmit} className="form" style={{ marginTop: 12 }}>
          <div className="field">
            <label>Username / NIS</label>
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="contoh: 123456"
            />
          </div>
          <div className="field">
            <label>Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
            />
          </div>

          {err ? <div className="notice noticeErr">⚠️ {err}</div> : null}

          <button className="btn btnPrimary" disabled={loading} type="submit">
            {loading ? "Memproses..." : "Masuk"}
          </button>

          <div className="small">
            Tip: setelah selesai setup, ganti password superadmin dan hapus
            route seed.
          </div>
        </form>
      </div>
    </div>
  );
}
