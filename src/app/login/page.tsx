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
        /* ✅ Font yang lebih “mahal” & modern */
        @import url("https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Inter:wght@400;500;600;700;800;900&display=swap");

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

        /* ✅ Typography baseline yang lebih clean */
        body {
          font-family: "Plus Jakarta Sans", "Inter", ui-sans-serif, system-ui,
            -apple-system, Segoe UI, Roboto, "Helvetica Neue", Arial,
            "Noto Sans", "Liberation Sans", sans-serif;

          letter-spacing: -0.012em;
          text-rendering: geometricPrecision;
          -webkit-font-smoothing: antialiased;
          -moz-osx-font-smoothing: grayscale;
          font-feature-settings: "ss01" 1, "cv02" 1, "cv03" 1, "cv04" 1,
            "cv11" 1;
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
              rgba(255, 255, 255, 0.88),
              rgba(255, 255, 255, 0.58)
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
          width: 50px;
          height: 50px;
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
          font-weight: 800;
          letter-spacing: -0.03em;
        }
        .heroBrand span {
          font-size: 13px;
          font-weight: 600;
          color: var(--muted);
          margin-top: 4px;
          letter-spacing: -0.01em;
        }

        .heroTitle {
          margin: 18px 0 0;
          font-size: 32px;
          line-height: 1.12;
          letter-spacing: -0.045em;
          font-weight: 850;
        }
        .heroSub {
          margin: 10px 0 0;
          color: var(--muted);
          font-size: 14.5px;
          line-height: 1.65;
          max-width: 54ch;
          font-weight: 600;
          letter-spacing: -0.01em;
        }

        .heroCards {
          margin-top: 18px;
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 12px;
        }

        .infoCard {
          background: rgba(255, 255, 255, 0.78);
          border: 1px solid var(--line);
          border-radius: 16px;
          padding: 14px 14px;
          backdrop-filter: blur(10px);
        }
        .infoCard b {
          display: block;
          font-size: 13.5px;
          font-weight: 800;
          margin-bottom: 4px;
          letter-spacing: -0.02em;
        }
        .infoCard p {
          margin: 0;
          color: var(--muted);
          font-size: 13px;
          line-height: 1.55;
          font-weight: 600;
          letter-spacing: -0.01em;
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
          font-weight: 800;
          font-size: 12px;
          letter-spacing: -0.01em;
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
          font-weight: 850;
          letter-spacing: -0.03em;
        }

        .hr {
          height: 1px;
          background: var(--line);
          margin: 14px 0;
        }

        .h1 {
          margin: 0;
          font-size: 22px;
          font-weight: 900;
          letter-spacing: -0.03em;
          line-height: 1.1;
        }

        .form {
          margin-top: 14px;
          display: grid;
          gap: 12px;
        }

        .field {
          display: grid;
          gap: 7px;
        }

        .field label {
          font-size: 12.5px;
          color: var(--muted);
          font-weight: 800;
          letter-spacing: -0.01em;
        }

        .input {
          height: 46px;
          border-radius: 12px;
          border: 1px solid var(--line);
          padding: 0 12px;
          font-size: 14px;
          outline: none;
          background: #fff;
          font-weight: 650;
          letter-spacing: -0.01em;
        }

        .input::placeholder {
          color: rgba(100, 116, 139, 0.75);
          font-weight: 600;
        }

        .input:focus {
          border-color: rgba(37, 99, 235, 0.38);
          box-shadow: 0 0 0 4px rgba(37, 99, 235, 0.1);
        }

        .notice {
          border-radius: 14px;
          padding: 12px 12px;
          border: 1px solid var(--line);
          font-size: 13px;
          font-weight: 750;
          display: flex;
          gap: 10px;
          align-items: center;
          letter-spacing: -0.01em;
        }

        .noticeErr {
          background: rgba(239, 68, 68, 0.08);
          border-color: rgba(239, 68, 68, 0.18);
          color: rgba(185, 28, 28, 1);
        }

        .btn {
          height: 46px;
          border-radius: 12px;
          border: 1px solid var(--line);
          background: #fff;
          font-weight: 900;
          font-size: 14px;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          letter-spacing: -0.015em;
          transition: transform 0.05s ease, background 0.15s ease,
            box-shadow 0.15s ease, border-color 0.15s ease;
        }

        .btn:active {
          transform: translateY(1px);
        }

        .btnPrimary {
          background: linear-gradient(180deg, var(--brand), var(--brand2));
          color: #fff;
          border-color: rgba(37, 99, 235, 0.25);
          box-shadow: 0 14px 30px rgba(37, 99, 235, 0.22);
        }
        .btnPrimary:hover {
          filter: brightness(1.02);
        }
        .btn:disabled {
          opacity: 0.75;
          cursor: not-allowed;
          box-shadow: none;
        }

        .footNote {
          margin-top: 10px;
          color: var(--muted);
          font-size: 12.5px;
          line-height: 1.55;
          font-weight: 600;
          letter-spacing: -0.01em;
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
          line-height: 1.5;
          font-weight: 600;
          letter-spacing: -0.01em;
        }

        .helper b {
          font-weight: 850;
          color: rgba(15, 23, 42, 0.88);
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
                  width={50}
                  height={50}
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
                  fontWeight: 900,
                  letterSpacing: "-0.01em",
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

            <h1 className="h1">Login</h1>

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
