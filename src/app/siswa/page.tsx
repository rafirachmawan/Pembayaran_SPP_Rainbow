"use client";

import { useEffect, useMemo, useState } from "react";

function formatPeriode(yyyyMM?: string) {
  if (!yyyyMM) return "-";
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

type Prize = {
  id: string;
  label: string;
  type: "FIXED" | "PERCENT" | "NONE";
  value: number;
  quota: number;
  used: number;
};

export default function SiswaPage() {
  const [data, setData] = useState<any>(null);
  const [prizes, setPrizes] = useState<Prize[]>([]);
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(
    null
  );
  const [loading, setLoading] = useState(false);
  const [spinning, setSpinning] = useState(false);

  // rotasi wheel (deg)
  const [rot, setRot] = useState(0);

  const segCount = Math.max(1, prizes.length);
  const segAngle = 360 / segCount;

  // buat conic-gradient otomatis sesuai jumlah hadiah
  const wheelBg = useMemo(() => {
    const colors = [
      "#2563eb",
      "#60a5fa",
      "#22c55e",
      "#f59e0b",
      "#ef4444",
      "#a855f7",
      "#14b8a6",
      "#f97316",
    ];
    const parts: string[] = [];
    for (let i = 0; i < segCount; i++) {
      const start = i * segAngle;
      const end = (i + 1) * segAngle;
      parts.push(`${colors[i % colors.length]} ${start}deg ${end}deg`);
    }
    return `conic-gradient(${parts.join(",")})`;
  }, [segCount, segAngle]);

  async function loadInvoice() {
    setMsg(null);
    setLoading(true);
    const res = await fetch("/api/siswa/invoice/current");
    const d = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok)
      return setMsg({ type: "err", text: d?.error || "Gagal load invoice" });
    setData(d);
  }

  async function loadPrizes() {
    const res = await fetch("/api/siswa/spin/prizes");
    const d = await res.json().catch(() => ({}));
    if (!res.ok) {
      // diam aja, biar siswa tetap bisa lihat invoice
      return;
    }
    setPrizes(Array.isArray(d.prizes) ? d.prizes : []);
  }

  async function refreshAll() {
    await Promise.all([loadInvoice(), loadPrizes()]);
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    location.href = "/login";
  }

  // animasi spin (visual), lalu panggil backend untuk hasil final
  async function spin() {
    setMsg(null);
    if (spinning) return;

    if (!prizes.length) {
      return setMsg({
        type: "err",
        text: "Hadiah spin belum diset admin / kuota habis.",
      });
    }

    setSpinning(true);

    // tentukan target index visual (random)
    const targetIndex = Math.floor(Math.random() * segCount);

    // agar pointer “nunjuk ke segmen”, kita putar wheel sehingga segmen target berhenti di atas.
    // pointer ada di posisi 12 o'clock (atas). Center segmen = (index+0.5)*segAngle
    const targetCenter = (targetIndex + 0.5) * segAngle;

    // rotasi akhir: beberapa putaran + geser supaya targetCenter berada di 0deg (atas)
    const extraSpins = 5; // makin besar makin "wah"
    const finalRot = extraSpins * 360 + (360 - targetCenter);

    // set rotasi dari posisi sekarang ke posisi final (tambah supaya terasa natural)
    const base = rot % 360;
    const next = rot - base + finalRot;

    setRot(next);

    // tunggu animasi selesai (sinkron dengan CSS durasi)
    await new Promise((r) => setTimeout(r, 4200));

    // panggil backend untuk hasil resmi
    const res = await fetch("/api/siswa/spin", { method: "POST" });
    const d = await res.json().catch(() => ({}));

    if (!res.ok) {
      setSpinning(false);
      await loadInvoice();
      return setMsg({ type: "err", text: d?.error || "Spin gagal" });
    }

    setMsg({ type: "ok", text: `Kamu dapat: ${d.prize.label}` });
    await refreshAll();
    setSpinning(false);
  }

  useEffect(() => {
    refreshAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
            <button className="btn" onClick={refreshAll}>
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
                  <div className="small" style={{ marginTop: 8 }}>
                    Jika hadiah habis (kuota), admin perlu tambah hadiah lagi.
                  </div>
                </div>

                <div
                  className="card"
                  style={{ boxShadow: "none", background: "var(--brandSoft)" }}
                >
                  <div className="sectionTitle">
                    <h2>Lucky Spin</h2>
                    <span className="badge">Lucky Draw</span>
                  </div>

                  <div className="wheelWrap">
                    <div className="wheelStage">
                      <div className="pointer" />
                      <div
                        className="wheel"
                        style={
                          {
                            background: wheelBg,
                            ["--rot" as any]: `${rot}deg`,
                            ["--dur" as any]: spinning ? "4000ms" : "600ms",
                          } as any
                        }
                      />
                      <div className="wheelCenter">
                        {spinning ? "..." : "SPIN"}
                      </div>
                    </div>

                    <div className="wheelLabels">
                      {prizes.length ? (
                        prizes.slice(0, 8).map((p) => (
                          <div className="prizeItem" key={p.id}>
                            <b>{p.label}</b>
                            <span>
                              sisa{" "}
                              {Math.max(0, Number(p.quota) - Number(p.used))}
                            </span>
                          </div>
                        ))
                      ) : (
                        <div className="small">
                          Hadiah belum ada / kuota habis.
                        </div>
                      )}
                    </div>
                  </div>

                  <button
                    className="btn btnPrimary"
                    onClick={spin}
                    disabled={spinning}
                    style={{ width: "100%", marginTop: 12 }}
                  >
                    {spinning ? "Memutar..." : "Spin Sekarang"}
                  </button>

                  <div className="small" style={{ marginTop: 8 }}>
                    Diskon otomatis terpasang ke tagihan setelah spin.
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
