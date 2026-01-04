"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";

// ✅ logo dari: src/assets/rainbow.jpeg
import rainbowLogo from "../../assets/rainbow.jpeg";

export default function LoginPage() {
  const [mounted, setMounted] = useState(false);

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    setMounted(true);
  }, []);

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

  // ✅ cegah hydration mismatch
  if (!mounted) return null;

  return (
    <>
      <style jsx global>{`
        :root {
          --bg: #f5f7fb;
          --card: #ffffff;
          --text: #0f172a;
          --muted: #64748b;
          --line: rgba(15, 23, 42, 0.08);
          --brand: #2563eb;
          --brand2: #1d4ed8;
          --brandSoft: rgba(37, 99, 235, 0.09);
          --danger: #ef4444;
          --shadow: 0 18px 50px rgba(15, 23, 42, 0.12);
          --radius: 18px;
        }

        html,
        body {
          height: 100%;
          background: var(--bg);
          color: var(--text);
        }

        * {
          box-sizing: border-box;
        }

        body {
          font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto,
            "Helvetica Neue", Arial, "Noto Sans", "Liberation Sans", sans-serif;
          letter-spacing: -0.01em;
        }

        .page {
          min-height: 100vh;
          display: grid;
          align-items: center;
          justify-items: center;
          padding: 28px 16px;
          position: relative;
          overflow: hidden;
        }

        /* decorative blobs */
        .blob1,
        .blob2 {
          position: absolute;
          width: 520px;
          height: 520px;
          border-radius: 999px;
          filter: blur(50px);
          opacity: 0.5;
          pointer-events: none;
        }
        .blob1 {
          background: rgba(37, 99, 235, 0.18);
          top: -180px;
          left: -220px;
        }
        .blob2 {
          background: rgba(34, 197, 94, 0.12);
          bottom: -220px;
          right: -240px;
        }

        .shell {
          width: min(1060px, 100%);
          display: grid;
          grid-template-columns: 1.15fr 0.85fr;
          gap: 18px;
          align-items: stretch;
        }

        .hero {
          border-radius: var(--radius);
          border: 1px solid var(--line);
          background: linear-gradient(
              180deg,
              rgba(255, 255, 255, 0.85),
              rgba(255, 255, 255, 0.55)
            ),
            radial-gradient(
              1200px 500px at 20% 10%,
              rgba(37, 99, 235, 0.22),
              transparent 55%
            ),
            radial-gradient(
              1000px 500px at 40% 90%,
              rgba(34, 197, 94, 0.12),
              transparent 55%
            );
          box-shadow: var(--shadow);
          padding: 26px 26px;
          position: relative;
          overflow: hidden;
        }

        .heroTop {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        /* ✅ logo */
        .crest {
          width: 48px;
          height: 48px;
          border-radius: 14px;
          overflow: hidden;
          background: #fff;
          border: 1px solid var(--line);
          box-shadow: 0 12px 28px rgba(37, 99, 235, 0.18);
          flex: 0 0 auto;
        }

        .heroBrand {
          display: flex;
          flex-direction: column;
          line-height: 1.05;
        }
        .heroBrand b {
          font-size: 18px;
          letter-spacing: -0.02em;
        }
        .heroBrand span {
          font-size: 13px;
          color: var(--muted);
          margin-top: 4px;
        }

        .heroTitle {
          margin: 18px 0 0;
          font-size: 30px;
          line-height: 1.15;
          letter-spacing: -0.03em;
        }
        .heroSub {
          margin: 10px 0 0;
          color: var(--muted);
          font-size: 14.5px;
          line-height: 1.6;
          max-width: 54ch;
        }

        .heroCards {
          margin-top: 18px;
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 12px;
        }

        .infoCard {
          background: rgba(255, 255, 255, 0.75);
          border: 1px solid var(--line);
          border-radius: 16px;
          padding: 14px 14px;
          backdrop-filter: blur(10px);
        }
        .infoCard b {
          display: block;
          font-size: 13.5px;
          margin-bottom: 4px;
        }
        .infoCard p {
          margin: 0;
          color: var(--muted);
          font-size: 13px;
          line-height: 1.5;
        }

        .badgeRow {
          margin-top: 14px;
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }

        .chip {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 8px 10px;
          border-radius: 999px;
          background: rgba(37, 99, 235, 0.08);
          border: 1px solid rgba(37, 99, 235, 0.14);
          color: rgba(29, 78, 216, 1);
          font-weight: 700;
          font-size: 12px;
        }

        .chipDot {
          width: 8px;
          height: 8px;
          border-radius: 999px;
          background: rgba(29, 78, 216, 1);
          box-shadow: 0 0 0 4px rgba(37, 99, 235, 0.12);
        }

        .panel {
          border-radius: var(--radius);
          border: 1px solid var(--line);
          background: var(--card);
          box-shadow: var(--shadow);
          padding: 22px;
          display: grid;
          align-content: start;
        }

        .panelHead {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
        }

        .panelTitle {
          display: flex;
          flex-direction: column;
          line-height: 1.05;
        }
        .panelTitle b {
          font-size: 16px;
          letter-spacing: -0.02em;
        }

        .hr {
          height: 1px;
          background: var(--line);
          margin: 14px 0;
        }

        .h1 {
          margin: 0;
          font-size: 22px;
          letter-spacing: -0.02em;
        }

        .form {
          margin-top: 14px;
          display: grid;
          gap: 12px;
        }

        .field {
          display: grid;
          gap: 6px;
        }

        .field label {
          font-size: 12.5px;
          color: var(--muted);
          font-weight: 750;
        }

        .input {
          height: 44px;
          border-radius: 12px;
          border: 1px solid var(--line);
          padding: 0 12px;
          font-size: 13.5px;
          outline: none;
          background: #fff;
        }

        .input:focus {
          border-color: rgba(37, 99, 235, 0.35);
          box-shadow: 0 0 0 4px rgba(37, 99, 235, 0.08);
        }

        .notice {
          border-radius: 14px;
          padding: 12px 12px;
          border: 1px solid var(--line);
          font-size: 13px;
          font-weight: 650;
          display: flex;
          gap: 10px;
          align-items: center;
        }

        .noticeErr {
          background: rgba(239, 68, 68, 0.08);
          border-color: rgba(239, 68, 68, 0.18);
          color: rgba(185, 28, 28, 1);
        }

        .btn {
          height: 44px;
          border-radius: 12px;
          border: 1px solid var(--line);
          background: #fff;
          font-weight: 800;
          font-size: 13.5px;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
        }

        .btnPrimary {
          background: var(--brand);
          color: #fff;
          border-color: rgba(37, 99, 235, 0.25);
        }
        .btnPrimary:hover {
          background: var(--brand2);
        }
        .btn:disabled {
          opacity: 0.7;
          cursor: not-allowed;
        }

        .footNote {
          margin-top: 10px;
          color: var(--muted);
          font-size: 12.5px;
          line-height: 1.5;
        }

        .helperRow {
          margin-top: 12px;
          display: grid;
          gap: 8px;
        }

        .helper {
          border: 1px dashed rgba(15, 23, 42, 0.18);
          background: rgba(15, 23, 42, 0.02);
          border-radius: 14px;
          padding: 10px 12px;
          font-size: 12.5px;
          color: var(--muted);
          line-height: 1.45;
        }

        /* Responsive */
        @media (max-width: 980px) {
          .shell {
            grid-template-columns: 1fr;
          }
          .heroCards {
            grid-template-columns: 1fr;
          }
        }
      `}</style>

      <div className="page">
        <div className="blob1" />
        <div className="blob2" />

        <div className="shell">
          {/* HERO KIRI */}
          <section className="hero" aria-hidden="true">
            <div className="heroTop">
              <div className="crest">
                <Image
                  src={rainbowLogo}
                  alt="Logo"
                  width={48}
                  height={48}
                  priority
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                />
              </div>

              <div className="heroBrand">
                <b>SPP SHINING SUN</b>
                <span>Portal Pembayaran SPP</span>
              </div>
            </div>

            <h2 className="heroTitle">
              Sistem Pembayaran SPP
              <br />
            </h2>

            <p className="heroSub">Login Menggunakan NIS</p>

            <div className="heroCards">
              <div className="infoCard">
                <b>✅ Aman & Terstruktur</b>
                <p>Autentikasi role-based: Siswa dan Super Admin.</p>
              </div>
              <div className="infoCard">
                <b>🎁 Lucky Spin</b>
                <p>Peluang hadiah dapat diatur menggunakan bobot (weight).</p>
              </div>
              <div className="infoCard">
                <b>📚 Data Siswa</b>
                <p>
                  NIS otomatis (0001, 0002, dst) agar rapi dan tidak loncat.
                </p>
              </div>
              <div className="infoCard">
                <b>📅 Periode Aktif</b>
                <p>Tagihan dan diskon terikat pada periode yang aktif.</p>
              </div>
            </div>

            <div className="badgeRow">
              <span className="chip">
                <span className="chipDot" />
                Sistem Pembayaran SPP
              </span>
              <span className="chip">
                <span className="chipDot" />
                flexible & powerful
              </span>
              <span className="chip">
                <span className="chipDot" />
                UI Clean & Modern
              </span>
            </div>
          </section>

          {/* PANEL LOGIN KANAN */}
          <section className="panel">
            <div className="panelHead">
              <div className="panelTitle">
                <b>Login Sesuai Dengan NIS</b>
              </div>
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 800,
                  color: "rgba(29,78,216,1)",
                  background: "rgba(37,99,235,0.08)",
                  border: "1px solid rgba(37,99,235,0.14)",
                  padding: "7px 10px",
                  borderRadius: 999,
                }}
              >
                SPP SHINING SUN
              </span>
            </div>

            <div className="hr" />

            <h1 className="h1">Login </h1>

            <form onSubmit={onSubmit} className="form">
              <div className="field">
                <label>NIS</label>
                <input
                  className="input"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="contoh: 0001"
                  autoComplete="username"
                />
              </div>

              <div className="field">
                <label>Password</label>
                <input
                  className="input"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="current-password"
                />
              </div>

              {err ? <div className="notice noticeErr">⚠️ {err}</div> : null}

              <button
                className="btn btnPrimary"
                disabled={loading}
                type="submit"
              >
                {loading ? "Memproses..." : "Masuk"}
              </button>

              <div className="helperRow">
                <div className="helper">
                  <b>Catatan:</b> Jika Anda Lupa NIS Bisa Menghubungi NO :{" "}
                  <b>08123456789</b>.
                </div>
              </div>

              <div className="footNote">
                © {new Date().getFullYear()} SPP SHINING SUN •
              </div>
            </form>
          </section>
        </div>
      </div>
    </>
  );
}
