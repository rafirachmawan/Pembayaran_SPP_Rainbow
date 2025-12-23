"use client";

import { useEffect, useState } from "react";

function formatPeriode(yyyyMM?: string) {
  if (!yyyyMM) return "-";
  // expecting "YYYY-MM"
  const [yStr, mStr] = yyyyMM.split("-");
  const y = Number(yStr);
  const m = Number(mStr);
  if (!Number.isFinite(y) || !Number.isFinite(m) || m < 1 || m > 12)
    return yyyyMM;

  const bulan = [
    "Januari",
    "Februari",
    "Maret",
    "April",
    "Mei",
    "Juni",
    "Juli",
    "Agustus",
    "September",
    "Oktober",
    "November",
    "Desember",
  ];

  return `${bulan[m - 1]} ${y}`;
}

export default function SiswaPage() {
  const [data, setData] = useState<any>(null);
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(
    null
  );
  const [loading, setLoading] = useState(false);

  async function load() {
    setMsg(null);
    setLoading(true);
    const res = await fetch("/api/siswa/invoice/current");
    const d = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok)
      return setMsg({ type: "err", text: d?.error || "Gagal load invoice" });
    setData(d);
  }

  async function spin() {
    setMsg(null);
    const res = await fetch("/api/siswa/spin", { method: "POST" });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) return setMsg({ type: "err", text: d?.error || "Spin gagal" });
    setMsg({ type: "ok", text: `Selamat! Kamu dapat: ${d.prize.label}` });
    await load();
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    location.href = "/login";
  }

  useEffect(() => {
    load();
  }, []);

  const inv = data?.invoice;
  const period = data?.period;

  return (
    <>
      <div className="topbar">
        <div className="topbarInner">
          <div className="brand">
            <div className="logo" />
            <div className="brandTitle">
              <b>SPP Rainbow</b>
              <span>Dashboard Siswa</span>
            </div>
          </div>
          <div className="actions">
            <button className="btn" onClick={load}>
              {loading ? "Memuat..." : "Refresh"}
            </button>
            <button className="btn btnDanger" onClick={logout}>
              Logout
            </button>
          </div>
        </div>
      </div>

      <div className="container">
        <div className="card">
          <h1 className="h1">Tagihan SPP</h1>
          <p className="p">
            Periode: <b>{formatPeriode(period?.period)}</b>
          </p>

          {msg ? (
            <div
              className={
                msg.type === "ok" ? "notice noticeOk" : "notice noticeErr"
              }
            >
              {msg.type === "ok" ? "✅" : "⚠️"} {msg.text}
            </div>
          ) : null}

          <div className="hr" />

          {!inv ? (
            <div className="small">
              Memuat data... <br />
              Jika lama, pastikan admin sudah set SPP period aktif.
            </div>
          ) : (
            <>
              <div className="kpis">
                <div className="kpi">
                  <div className="label">SPP</div>
                  <div className="value">
                    Rp {Number(inv.base_amount).toLocaleString("id-ID")}
                  </div>
                </div>
                <div className="kpi">
                  <div className="label">Diskon</div>
                  <div className="value">
                    Rp {Number(inv.discount_amount).toLocaleString("id-ID")}
                  </div>
                </div>
                <div className="kpi">
                  <div className="label">Total Bayar</div>
                  <div className="value">
                    Rp {Number(inv.final_amount).toLocaleString("id-ID")}
                  </div>
                </div>
              </div>

              <div className="hr" />

              <div className="grid2">
                <div className="card" style={{ boxShadow: "none" }}>
                  <div className="sectionTitle">
                    <h2>Status</h2>
                    <span className="badge">
                      {inv.status === "PAID" ? "PAID" : "UNPAID"}
                    </span>
                  </div>
                  <div className="small">
                    Lucky Spin hanya bisa <b>1x</b> dan hanya sebelum tanggal{" "}
                    <b>{period.spin_deadline_day}</b>.
                  </div>
                </div>

                <div
                  className="card"
                  style={{ boxShadow: "none", background: "var(--brandSoft)" }}
                >
                  <div className="sectionTitle">
                    <h2>Lucky Spin</h2>
                    <span className="badge">Diskon</span>
                  </div>
                  <button
                    className="btn btnPrimary"
                    onClick={spin}
                    style={{ width: "100%" }}
                  >
                    Spin Sekarang
                  </button>
                  <div className="small" style={{ marginTop: 8 }}>
                    Jika sudah spin, diskon otomatis terpasang di tagihan.
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        <div style={{ height: 18 }} />
        <div className="small">© {new Date().getFullYear()} SPP Rainbow</div>
      </div>
    </>
  );
}
