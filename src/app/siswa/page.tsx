"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";

// ✅ ambil gambar dari src/assets (TIDAK pindah file)
import rainbowLogo from "@/assets/rainbow.jpeg";

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
  weight?: number;
};

type PaymentRow = {
  id: string;
  period: string; // YYYY-MM
  amount: number; // nominal yang dibayar
  status: "PAID" | "UNPAID" | "PENDING" | string;
  paid_at?: string | null; // ISO date
  method?: string | null;
  ref?: string | null;
};

type MenuKey = "BAYAR" | "RIWAYAT";

export default function SiswaPage() {
  const [mounted, setMounted] = useState(false);

  const [menu, setMenu] = useState<MenuKey>("BAYAR");

  const [data, setData] = useState<any>(null);
  const [prizes, setPrizes] = useState<Prize[]>([]);
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(
    null
  );
  const [loading, setLoading] = useState(false);
  const [spinning, setSpinning] = useState(false);

  // sidebar riwayat pembayaran
  const [payHistory, setPayHistory] = useState<PaymentRow[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // rotasi wheel (deg)
  const [rot, setRot] = useState(0);

  const segCount = Math.max(1, prizes.length);
  const segAngle = 360 / segCount;

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
    if (!res.ok) return;
    setPrizes(Array.isArray(d.prizes) ? d.prizes : []);
  }

  /**
   * ✅ Riwayat pembayaran sukses
   * GET /api/siswa/payments/history -> { ok:true, payments:[...] }
   */
  async function loadPayHistory() {
    setLoadingHistory(true);
    const res = await fetch("/api/siswa/payments/history");
    const d = await res.json().catch(() => ({}));
    setLoadingHistory(false);

    if (!res.ok) {
      setPayHistory([]);
      return;
    }

    const rows: PaymentRow[] = Array.isArray(d.payments) ? d.payments : [];
    const paidOnly = rows.filter(
      (r) => String(r.status).toUpperCase() === "PAID"
    );
    paidOnly.sort((a, b) => {
      const ta = a.paid_at ? new Date(a.paid_at).getTime() : 0;
      const tb = b.paid_at ? new Date(b.paid_at).getTime() : 0;
      return tb - ta;
    });

    setPayHistory(paidOnly);
  }

  async function refreshAll() {
    await Promise.all([loadInvoice(), loadPrizes(), loadPayHistory()]);
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    location.href = "/login";
  }

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

    const res = await fetch("/api/siswa/spin", { method: "POST" });
    const d = await res.json().catch(() => ({}));

    if (!res.ok) {
      setSpinning(false);
      await loadInvoice();
      return setMsg({ type: "err", text: d?.error || "Spin gagal" });
    }

    const prizeId = String(d?.prize?.id || d?.prize_id || "");
    const prizeLabel = String(d?.prize?.label || "Hadiah");

    let targetIndex = prizes.findIndex((p) => p.id === prizeId);
    if (targetIndex < 0) targetIndex = Math.floor(Math.random() * segCount);

    const targetCenter = (targetIndex + 0.5) * segAngle;
    const extraSpins = 5;
    const finalRot = extraSpins * 360 + (360 - targetCenter);

    const base = rot % 360;
    const next = rot - base + finalRot;
    setRot(next);

    await new Promise((r) => setTimeout(r, 4200));

    setMsg({ type: "ok", text: `Kamu dapat: ${prizeLabel}` });

    await refreshAll();
    setSpinning(false);
  }

  useEffect(() => {
    setMounted(true);
    refreshAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const inv = data?.invoice;
  const period = data?.period;

  // ✅ nama sidebar pakai username (fallback aman)
  const displayName =
    String(
      data?.user?.username ||
        data?.session?.username ||
        data?.username ||
        data?.student?.username ||
        data?.student?.nama ||
        ""
    ).trim() || "-";

  // =========================
  // ✅ FITUR BAYAR (BARU)
  // =========================
  const [payOpen, setPayOpen] = useState(false);
  const [payMethod, setPayMethod] = useState("TRANSFER");
  const [payFile, setPayFile] = useState<File | null>(null);
  const [paySubmitting, setPaySubmitting] = useState(false);

  function openPay() {
    setMsg(null);
    setPayFile(null);
    setPayMethod("TRANSFER");
    setPayOpen(true);
  }

  function closePay() {
    setPayOpen(false);
  }

  async function fileToBase64(file: File) {
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error("Gagal baca file"));
      reader.onload = () => resolve(String(reader.result || ""));
      reader.readAsDataURL(file);
    });
  }

  async function submitPayment() {
    setMsg(null);

    if (!inv?.id) {
      return setMsg({ type: "err", text: "Invoice belum tersedia." });
    }

    if (!payFile) {
      return setMsg({ type: "err", text: "Bukti bayar wajib diupload." });
    }

    setPaySubmitting(true);
    try {
      const base64 = await fileToBase64(payFile);

      const res = await fetch("/api/siswa/payments/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          invoice_id: inv.id,
          method: payMethod,
          fileBase64: base64,
          mime: payFile.type,
          filename: payFile.name,
        }),
      });

      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        setPaySubmitting(false);
        return setMsg({
          type: "err",
          text: d?.error || "Gagal ajukan pembayaran",
        });
      }

      setMsg({
        type: "ok",
        text: "Pembayaran berhasil diajukan. Status: PENDING (menunggu verifikasi admin).",
      });

      setPaySubmitting(false);
      setPayOpen(false);
      await refreshAll();
    } catch (e: any) {
      setPaySubmitting(false);
      return setMsg({
        type: "err",
        text: e?.message || "Gagal ajukan pembayaran",
      });
    }
  }

  // =========================

  if (!mounted) return null;

  return (
    <>
      <style jsx global>{`
        :root {
          --bg: #f6f8fc;
          --card: #ffffff;
          --text: #0f172a;
          --muted: #64748b;
          --line: rgba(15, 23, 42, 0.08);
          --brand: #2563eb;
          --brand2: #1d4ed8;
          --brandSoft: rgba(37, 99, 235, 0.09);
          --danger: #ef4444;
          --shadow: 0 18px 55px rgba(15, 23, 42, 0.1);
          --radius: 18px;
        }
        html,
        body {
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

        .topbar {
          position: sticky;
          top: 0;
          z-index: 40;
          background: rgba(246, 248, 252, 0.85);
          backdrop-filter: blur(12px);
          border-bottom: 1px solid var(--line);
        }
        .topbarInner {
          max-width: 1400px;
          margin: 0 auto;
          padding: 14px 16px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
        }
        .brand {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        /* ✅ logo pakai gambar src/assets (import), bukan /public */
        .logoImg {
          width: 44px;
          height: 44px;
          border-radius: 14px;
          overflow: hidden;
          background: #fff;
          border: 1px solid rgba(15, 23, 42, 0.08);
          box-shadow: 0 14px 28px rgba(15, 23, 42, 0.12);
          flex: 0 0 auto;
        }

        .brandTitle {
          display: flex;
          flex-direction: column;
          line-height: 1.05;
        }
        .brandTitle b {
          font-size: 15.5px;
          letter-spacing: -0.02em;
        }
        .brandTitle span {
          font-size: 12px;
          color: var(--muted);
          margin-top: 3px;
        }
        .actions {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .btn {
          height: 40px;
          padding: 0 12px;
          border-radius: 12px;
          border: 1px solid var(--line);
          background: #fff;
          color: var(--text);
          font-size: 13px;
          font-weight: 700;
          cursor: pointer;
        }
        .btn:hover {
          box-shadow: 0 12px 26px rgba(15, 23, 42, 0.08);
        }
        .btnPrimary {
          background: var(--brand);
          border-color: rgba(37, 99, 235, 0.25);
          color: #fff;
        }
        .btnPrimary:hover {
          background: var(--brand2);
        }
        .btnDanger {
          border-color: rgba(239, 68, 68, 0.35);
          color: var(--danger);
          background: #fff;
        }
        .btn:disabled {
          opacity: 0.7;
          cursor: not-allowed;
        }

        .layout {
          max-width: 1400px;
          margin: 0 auto;
          padding: 16px;
          display: grid;
          grid-template-columns: 280px 1fr;
          gap: 16px;
          align-items: start;
        }

        .sidebar {
          position: sticky;
          top: 76px;
          background: var(--card);
          border: 1px solid var(--line);
          border-radius: var(--radius);
          box-shadow: var(--shadow);
          overflow: hidden;
        }
        .sideHead {
          padding: 16px;
          border-bottom: 1px solid var(--line);
        }
        .sideHead b {
          display: block;
          font-size: 14px;
          letter-spacing: -0.01em;
        }
        .sideHead span {
          display: block;
          margin-top: 6px;
          font-size: 12.5px;
          color: var(--muted);
        }

        .sideNav {
          padding: 10px;
          display: grid;
          gap: 8px;
        }
        .navBtn {
          width: 100%;
          text-align: left;
          padding: 12px 12px;
          border-radius: 14px;
          border: 1px solid var(--line);
          background: #fff;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
        }
        .navBtn:hover {
          box-shadow: 0 12px 26px rgba(15, 23, 42, 0.06);
        }
        .navBtnActive {
          background: rgba(37, 99, 235, 0.08);
          border-color: rgba(37, 99, 235, 0.18);
        }
        .navTitle {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }
        .navTitle b {
          font-size: 13.5px;
          letter-spacing: -0.01em;
        }
        .navTitle span {
          font-size: 12px;
          color: var(--muted);
        }

        .pill {
          display: inline-flex;
          align-items: center;
          padding: 6px 10px;
          border-radius: 999px;
          background: rgba(37, 99, 235, 0.08);
          color: rgba(37, 99, 235, 1);
          border: 1px solid rgba(37, 99, 235, 0.12);
          font-size: 12px;
          font-weight: 800;
          white-space: nowrap;
        }

        .content {
          min-width: 0;
          display: grid;
          gap: 14px;
        }
        .card {
          background: var(--card);
          border: 1px solid var(--line);
          border-radius: var(--radius);
          box-shadow: var(--shadow);
          padding: 18px;
        }
        .h1 {
          margin: 0;
          font-size: 20px;
          letter-spacing: -0.02em;
        }
        .p {
          margin: 8px 0 0;
          color: var(--muted);
          font-size: 13.5px;
          line-height: 1.6;
        }
        .hr {
          height: 1px;
          background: var(--line);
          margin: 14px 0;
        }
        .small {
          color: var(--muted);
          font-size: 13px;
          line-height: 1.55;
        }

        .notice {
          border-radius: 14px;
          padding: 12px 14px;
          border: 1px solid var(--line);
          font-size: 13.5px;
          font-weight: 650;
          display: flex;
          gap: 10px;
          align-items: center;
          margin-top: 10px;
        }
        .noticeOk {
          background: rgba(34, 197, 94, 0.08);
          border-color: rgba(34, 197, 94, 0.18);
        }
        .noticeErr {
          background: rgba(239, 68, 68, 0.08);
          border-color: rgba(239, 68, 68, 0.18);
          color: rgba(185, 28, 28, 1);
        }

        .kpis {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 12px;
        }
        .kpi {
          border: 1px solid var(--line);
          border-radius: 16px;
          background: #fff;
          padding: 12px;
        }
        .kpi .label {
          color: var(--muted);
          font-size: 12px;
          font-weight: 700;
          margin-bottom: 4px;
        }
        .kpi .value {
          font-size: 18px;
          font-weight: 900;
          letter-spacing: -0.02em;
        }

        .grid2 {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 12px;
        }

        .sectionTitle {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          margin-bottom: 8px;
        }
        .sectionTitle h2 {
          margin: 0;
          font-size: 16px;
          letter-spacing: -0.02em;
        }

        .badge {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 7px 10px;
          border-radius: 999px;
          font-size: 12px;
          font-weight: 900;
          border: 1px solid var(--line);
          background: #fff;
        }
        .badgeOk {
          background: rgba(34, 197, 94, 0.1);
          border-color: rgba(34, 197, 94, 0.18);
          color: rgba(22, 163, 74, 1);
        }
        .badgeWarn {
          background: rgba(245, 158, 11, 0.1);
          border-color: rgba(245, 158, 11, 0.18);
          color: rgba(180, 83, 9, 1);
        }

        /* Wheel */
        .wheelWrap {
          margin-top: 10px;
          display: grid;
          gap: 10px;
        }
        .wheelStage {
          position: relative;
          width: 260px;
          height: 260px;
          margin: 0 auto;
          display: grid;
          place-items: center;
        }
        .pointer {
          position: absolute;
          top: -2px;
          left: 50%;
          transform: translateX(-50%);
          width: 0;
          height: 0;
          border-left: 10px solid transparent;
          border-right: 10px solid transparent;
          border-bottom: 16px solid #111827;
          z-index: 2;
        }
        .wheel {
          width: 240px;
          height: 240px;
          border-radius: 999px;
          border: 10px solid #fff;
          box-shadow: 0 18px 40px rgba(15, 23, 42, 0.14);
          transform: rotate(var(--rot, 0deg));
          transition: transform var(--dur, 600ms) cubic-bezier(0.1, 0.8, 0.1, 1);
        }
        .wheelCenter {
          position: absolute;
          width: 74px;
          height: 74px;
          border-radius: 999px;
          background: #fff;
          display: grid;
          place-items: center;
          font-weight: 900;
          border: 1px solid var(--line);
        }

        /* table */
        .tableWrap {
          overflow-x: auto;
          border: 1px solid var(--line);
          border-radius: 14px;
          background: #fff;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          min-width: 680px;
        }
        thead th {
          text-align: left;
          font-size: 12px;
          color: var(--muted);
          padding: 12px;
          border-bottom: 1px solid var(--line);
          background: rgba(15, 23, 42, 0.02);
        }
        tbody td {
          padding: 12px;
          border-bottom: 1px solid var(--line);
          font-size: 13.5px;
        }
        tbody tr:hover td {
          background: rgba(37, 99, 235, 0.035);
        }

        /* ✅ Modal bayar */
        .modalBack {
          position: fixed;
          inset: 0;
          background: rgba(15, 23, 42, 0.55);
          display: grid;
          place-items: center;
          z-index: 80;
          padding: 16px;
        }
        .modalCard {
          width: min(720px, 96vw);
          background: #fff;
          border-radius: 18px;
          border: 1px solid var(--line);
          box-shadow: 0 28px 80px rgba(15, 23, 42, 0.22);
          overflow: hidden;
        }
        .modalHead {
          padding: 14px 16px;
          border-bottom: 1px solid var(--line);
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
        }
        .modalBody {
          padding: 16px;
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
          font-weight: 800;
        }
        .field select,
        .field input {
          height: 42px;
          border-radius: 12px;
          border: 1px solid var(--line);
          padding: 0 12px;
          font-size: 13.5px;
          outline: none;
          background: #fff;
        }
        .modalFoot {
          padding: 14px 16px;
          border-top: 1px solid var(--line);
          display: flex;
          justify-content: flex-end;
          gap: 10px;
        }

        @media (max-width: 980px) {
          .layout {
            grid-template-columns: 1fr;
          }
          .sidebar {
            position: relative;
            top: 0;
          }
          .kpis {
            grid-template-columns: 1fr;
          }
          .grid2 {
            grid-template-columns: 1fr;
          }
        }
      `}</style>

      <div className="topbar">
        <div className="topbarInner">
          <div className="brand">
            <div className="logoImg">
              <Image
                src={rainbowLogo}
                alt="Rainbow Logo"
                width={44}
                height={44}
                priority
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
              />
            </div>

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

      <div className="layout">
        <aside className="sidebar">
          <div className="sideHead">
            <b>{displayName}</b>
            <span>
              Periode aktif: <b>{formatPeriode(period?.period)}</b>
            </span>
          </div>

          <div className="sideNav">
            <button
              className={`navBtn ${menu === "BAYAR" ? "navBtnActive" : ""}`}
              onClick={() => setMenu("BAYAR")}
              type="button"
            >
              <div className="navTitle">
                <b>Bayar SPP</b>
                <span>Tagihan + Lucky Spin</span>
              </div>
              <span className="pill">
                {inv?.status === "PAID" ? "PAID" : "UNPAID"}
              </span>
            </button>

            <button
              className={`navBtn ${menu === "RIWAYAT" ? "navBtnActive" : ""}`}
              onClick={() => setMenu("RIWAYAT")}
              type="button"
            >
              <div className="navTitle">
                <b>Riwayat Pembayaran</b>
                <span>Data pembayaran sukses</span>
              </div>
              <span className="pill">{payHistory.length} item</span>
            </button>
          </div>
        </aside>

        <main className="content">
          {menu === "BAYAR" ? (
            <div className="card">
              <h1 className="h1">Bayar SPP</h1>
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

                  <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
                    <button
                      className="btn btnPrimary"
                      onClick={openPay}
                      disabled={String(inv.status).toUpperCase() === "PAID"}
                    >
                      {String(inv.status).toUpperCase() === "PAID"
                        ? "Sudah PAID"
                        : "Ajukan Pembayaran"}
                    </button>
                    <div className="small" style={{ alignSelf: "center" }}>
                      Upload bukti bayar → status akan <b>PENDING</b> sampai
                      admin verifikasi.
                    </div>
                  </div>

                  <div className="hr" />

                  <div className="grid2">
                    <div className="card" style={{ boxShadow: "none" }}>
                      <div className="sectionTitle">
                        <h2>Status</h2>
                        <span
                          className={
                            inv.status === "PAID"
                              ? "badge badgeOk"
                              : "badge badgeWarn"
                          }
                        >
                          {inv.status === "PAID" ? "PAID" : "UNPAID"}
                        </span>
                      </div>
                      <div className="small">
                        Lucky Spin hanya bisa <b>1x</b> dan hanya sebelum
                        tanggal <b>{period?.spin_deadline_day}</b>.
                      </div>
                      <div className="small" style={{ marginTop: 8 }}>
                        Jika hadiah habis (kuota), admin perlu tambah hadiah
                        lagi.
                      </div>
                    </div>

                    <div
                      className="card"
                      style={{
                        boxShadow: "none",
                        background: "var(--brandSoft)",
                      }}
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
          ) : (
            <div className="card">
              <h1 className="h1">Riwayat Pembayaran</h1>
              <p className="p">
                Menampilkan riwayat pembayaran yang <b>sukses (PAID)</b>.
              </p>

              <div className="hr" />

              {loadingHistory ? (
                <div className="small">Memuat riwayat pembayaran…</div>
              ) : payHistory.length === 0 ? (
                <div className="small">Belum ada pembayaran sukses.</div>
              ) : (
                <div className="tableWrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Periode</th>
                        <th>Nominal</th>
                        <th>Status</th>
                        <th>Tanggal Bayar</th>
                        <th>Metode</th>
                        <th>Ref</th>
                      </tr>
                    </thead>
                    <tbody>
                      {payHistory.map((r) => (
                        <tr key={r.id}>
                          <td>
                            <b>{formatPeriode(r.period)}</b>
                          </td>
                          <td>
                            Rp {Number(r.amount || 0).toLocaleString("id-ID")}
                          </td>
                          <td>
                            <span className="badge badgeOk">PAID</span>
                          </td>
                          <td>
                            {r.paid_at
                              ? new Date(r.paid_at).toLocaleString("id-ID")
                              : "-"}
                          </td>
                          <td>{r.method || "-"}</td>
                          <td
                            style={{
                              fontFamily:
                                "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
                            }}
                          >
                            {r.ref || "-"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          <div className="small">© {new Date().getFullYear()} SPP Rainbow</div>
        </main>
      </div>

      {payOpen ? (
        <div className="modalBack" onClick={closePay}>
          <div className="modalCard" onClick={(e) => e.stopPropagation()}>
            <div className="modalHead">
              <b>Ajukan Pembayaran</b>
              <button className="btn btnDanger" onClick={closePay}>
                Tutup
              </button>
            </div>

            <div className="modalBody">
              <div className="small">
                Invoice: <b>{formatPeriode(period?.period)}</b> • Total:{" "}
                <b>
                  Rp {Number(inv?.final_amount || 0).toLocaleString("id-ID")}
                </b>
              </div>

              <div className="field">
                <label>Metode</label>
                <select
                  value={payMethod}
                  onChange={(e) => setPayMethod(e.target.value)}
                >
                  <option value="TRANSFER">TRANSFER</option>
                  <option value="CASH">CASH</option>
                  <option value="QRIS">QRIS</option>
                </select>
              </div>

              <div className="field">
                <label>Upload Bukti Bayar (JPG/PNG/PDF)</label>
                <input
                  type="file"
                  accept="image/*,.pdf"
                  onChange={(e) => setPayFile(e.target.files?.[0] || null)}
                />
                <div className="small">
                  {payFile ? (
                    <>
                      File: <b>{payFile.name}</b> (
                      {Math.round(payFile.size / 1024)} KB)
                    </>
                  ) : (
                    "Belum ada file dipilih."
                  )}
                </div>
              </div>
            </div>

            <div className="modalFoot">
              <button
                className="btn"
                onClick={closePay}
                disabled={paySubmitting}
              >
                Batal
              </button>
              <button
                className="btn btnPrimary"
                onClick={submitPayment}
                disabled={paySubmitting}
              >
                {paySubmitting ? "Mengirim..." : "Kirim Pembayaran"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
