"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type StudentRow = {
  id: string;
  username: string;
  nama: string;
  is_active: boolean;
  created_at: string;
};

type StudentDetail = {
  id: string;
  username: string;
  nama: string;
  kelas: string | null;
  phone: string | null;
  is_active: boolean;
  created_at: string;
  user_created_at: string | null;
};

type Payment = {
  id: string;
  student_id: string | null;
  nis: string | null;
  student_name: string | null;
  amount: number;
  status: string;
  created_at: string;
};

export default function CabangPage() {
  const router = useRouter();

  // ✅ hydration safe
  const [mounted, setMounted] = useState(false);

  const [tab, setTab] = useState<"siswa" | "pembayaran">("siswa");

  const [me, setMe] = useState<any>(null);
  const [branch, setBranch] = useState<any>(null);

  const [students, setStudents] = useState<StudentRow[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // form create siswa
  const [username, setUsername] = useState("");
  const [nama, setNama] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);

  // modal detail
  const [open, setOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detail, setDetail] = useState<StudentDetail | null>(null);

  async function loadMe() {
    const r = await fetch("/api/auth/me");
    const j = await r.json().catch(() => ({}));
    setMe(j?.user ?? null);
  }

  async function loadBranchMe() {
    const r = await fetch("/api/cabang/branch/me");
    const j = await r.json().catch(() => ({}));
    if (r.ok) setBranch(j?.branch ?? null);
  }

  async function loadStudents() {
    setErr(null);
    setLoading(true);
    const r = await fetch("/api/cabang/students/list");
    const j = await r.json().catch(() => ({}));
    setLoading(false);
    if (!r.ok) return setErr(j?.error || "Gagal ambil data siswa");

    const rows = (j?.students ?? []).map((s: any) => ({
      id: String(s.id),
      username: String(s.username ?? s.nis ?? ""),
      nama: String(s.nama ?? s.name ?? ""),
      is_active: Boolean(s.is_active ?? true),
      created_at: String(s.created_at ?? ""),
    }));

    setStudents(rows);
  }

  async function loadPayments() {
    setErr(null);
    setLoading(true);
    const r = await fetch("/api/cabang/payments/list");
    const j = await r.json().catch(() => ({}));
    setLoading(false);
    if (!r.ok) return setErr(j?.error || "Gagal ambil data pembayaran");
    setPayments(j?.payments ?? []);
  }

  async function approve(payment_id: string, status: "APPROVED" | "REJECTED") {
    setErr(null);
    const r = await fetch("/api/cabang/payments/approve", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ payment_id, status }),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) return setErr(j?.error || "Gagal update status pembayaran");
    await loadPayments();
  }

  async function createStudent() {
    setErr(null);
    setSaving(true);

    const r = await fetch("/api/cabang/students/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, nama, phone, password }),
    });

    const j = await r.json().catch(() => ({}));
    setSaving(false);

    if (!r.ok) return setErr(j?.error || "Gagal menambah siswa");

    setUsername("");
    setNama("");
    setPhone("");
    setPassword("");
    await loadStudents();
  }

  async function openDetail(studentId: string) {
    setErr(null);
    setOpen(true);
    setDetail(null);
    setDetailLoading(true);

    const r = await fetch(
      `/api/cabang/students/detail?id=${encodeURIComponent(studentId)}`
    );
    const j = await r.json().catch(() => ({}));

    setDetailLoading(false);
    if (!r.ok) {
      setErr(j?.error || "Gagal ambil detail siswa");
      return;
    }
    setDetail(j?.student ?? null);
  }

  useEffect(() => {
    setMounted(true);
    loadMe();
    loadBranchMe();
    loadStudents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!mounted) return;
    if (tab === "siswa") loadStudents();
    else loadPayments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, mounted]);

  const branchLabel = useMemo(() => {
    if (!branch) return "";
    const name = branch?.name || "";
    const code = branch?.code ? ` (${branch.code})` : "";
    return `${name}${code}`.trim();
  }, [branch]);

  const meName = useMemo(() => {
    const nm = String(me?.name || "").trim();
    return nm || "Admin";
  }, [me]);

  function initialsFromName(name: string) {
    const n = String(name || "").trim();
    if (!n) return "A";
    const parts = n.split(/\s+/).filter(Boolean);
    const a = parts[0]?.[0] || "";
    const b = parts.length > 1 ? parts[1]?.[0] || "" : "";
    return (a + b).toUpperCase() || "A";
  }

  async function onLogout() {
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
    router.push("/login");
  }

  if (!mounted) return null;

  return (
    <>
      <style jsx global>{`
        @import url("https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Inter:wght@400;500;600;700;800;900&display=swap");

        :root {
          --bg: #f6f8fc;
          --card: #ffffff;
          --text: #0f172a;
          --muted: #64748b;
          --line: rgba(15, 23, 42, 0.08);
          --brand: #2563eb;
          --brand2: #1d4ed8;
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
          font-family: "Plus Jakarta Sans", "Inter", ui-sans-serif, system-ui,
            -apple-system, Segoe UI, Roboto, "Helvetica Neue", Arial,
            "Noto Sans", "Liberation Sans", sans-serif;
          letter-spacing: -0.012em;
          text-rendering: geometricPrecision;
          -webkit-font-smoothing: antialiased;
          -moz-osx-font-smoothing: grayscale;
        }

        .page {
          max-width: 1400px;
          margin: 0 auto;
          padding: 16px;
          display: grid;
          grid-template-columns: 300px 1fr;
          gap: 16px;
          align-items: start;
        }

        .sidebar {
          position: sticky;
          top: 16px;
          background: linear-gradient(180deg, #ffffff, #fbfdff);
          border: 1px solid var(--line);
          border-radius: 22px;
          box-shadow: 0 22px 60px rgba(15, 23, 42, 0.12);
          overflow: hidden;
        }

        /* ✅ Sidebar clean header */
        .sideHead {
          padding: 14px;
          border-bottom: 1px solid var(--line);
          background: radial-gradient(
              1200px 420px at -20% -30%,
              rgba(37, 99, 235, 0.14),
              transparent 60%
            ),
            linear-gradient(
              180deg,
              rgba(255, 255, 255, 0.98),
              rgba(255, 255, 255, 0.92)
            );
        }

        .profile {
          padding: 12px;
          border-radius: 18px;
          border: 1px solid rgba(15, 23, 42, 0.08);
          background: rgba(255, 255, 255, 0.9);
          display: flex;
          gap: 12px;
          align-items: center;
        }

        .avatar {
          width: 44px;
          height: 44px;
          border-radius: 16px;
          display: grid;
          place-items: center;
          color: #0b1220;
          font-weight: 950;
          background: linear-gradient(
            135deg,
            rgba(37, 99, 235, 0.22),
            rgba(255, 255, 255, 0.9)
          );
          border: 1px solid rgba(37, 99, 235, 0.16);
          box-shadow: 0 14px 30px rgba(37, 99, 235, 0.16);
          flex: 0 0 auto;
        }

        .pText {
          min-width: 0;
          display: grid;
          gap: 3px;
        }
        .pName {
          font-weight: 950;
          letter-spacing: -0.02em;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          line-height: 1.1;
        }
        .pRole {
          font-size: 12px;
          color: var(--muted);
          font-weight: 750;
          line-height: 1.25;

          /* ✅ jangan kepotong */
          white-space: normal;
          overflow: visible;
          text-overflow: initial;
          word-break: break-word;
        }

        .sideNav {
          padding: 12px;
          display: grid;
          gap: 10px;
        }

        .navBtn {
          width: 100%;
          text-align: left;
          padding: 12px 12px 12px 14px;
          border-radius: 18px;
          border: 1px solid rgba(15, 23, 42, 0.08);
          background: rgba(255, 255, 255, 0.92);
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          position: relative;
          overflow: hidden;
          transition: transform 0.06s ease, box-shadow 0.16s ease,
            border-color 0.16s ease, background 0.16s ease;
        }

        .navBtn::before {
          content: "";
          position: absolute;
          inset: 0;
          background: radial-gradient(
            420px 160px at 0% 0%,
            rgba(37, 99, 235, 0.08),
            transparent 55%
          );
          opacity: 0;
          transition: opacity 0.18s ease;
        }

        .navBtn:hover {
          box-shadow: 0 16px 34px rgba(15, 23, 42, 0.09);
          border-color: rgba(37, 99, 235, 0.18);
        }
        .navBtn:hover::before {
          opacity: 1;
        }
        .navBtn:active {
          transform: translateY(1px);
        }

        .navBtnActive {
          background: rgba(37, 99, 235, 0.09);
          border-color: rgba(37, 99, 235, 0.22);
          box-shadow: 0 18px 42px rgba(37, 99, 235, 0.14);
        }
        .navBtnActive::before {
          opacity: 1;
        }
        .navBtnActive::after {
          content: "";
          position: absolute;
          left: 8px;
          top: 10px;
          bottom: 10px;
          width: 4px;
          border-radius: 999px;
          background: linear-gradient(
            180deg,
            rgba(37, 99, 235, 1),
            rgba(29, 78, 216, 1)
          );
          box-shadow: 0 10px 20px rgba(37, 99, 235, 0.25);
        }

        .navLeft {
          display: flex;
          align-items: center;
          gap: 10px;
          min-width: 0;
        }
        .navIcon {
          width: 34px;
          height: 34px;
          border-radius: 14px;
          display: grid;
          place-items: center;
          border: 1px solid rgba(15, 23, 42, 0.08);
          background: rgba(255, 255, 255, 0.92);
          box-shadow: 0 12px 22px rgba(15, 23, 42, 0.06);
          flex: 0 0 auto;
        }
        .navTitle {
          display: flex;
          flex-direction: column;
          gap: 2px;
          min-width: 0;
        }
        .navTitle b {
          font-size: 13.5px;
          font-weight: 950;
          letter-spacing: -0.02em;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .navTitle span {
          font-size: 12px;
          color: rgba(100, 116, 139, 1);
          font-weight: 700;
          letter-spacing: -0.01em;
        }

        .count {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-width: 30px;
          height: 28px;
          padding: 0 10px;
          border-radius: 999px;
          font-size: 12px;
          font-weight: 950;
          letter-spacing: -0.01em;
          color: rgba(37, 99, 235, 1);
          background: rgba(37, 99, 235, 0.1);
          border: 1px solid rgba(37, 99, 235, 0.16);
        }

        .sideFooter {
          padding: 12px;
          border-top: 1px solid var(--line);
          display: grid;
          gap: 10px;
        }

        .btn {
          height: 42px;
          padding: 0 12px;
          border-radius: 14px;
          border: 1px solid var(--line);
          background: #fff;
          color: var(--text);
          font-size: 13px;
          font-weight: 900;
          letter-spacing: -0.01em;
          cursor: pointer;
          transition: transform 0.05s ease, box-shadow 0.15s ease,
            border-color 0.15s ease;
        }
        .btn:hover {
          box-shadow: 0 12px 26px rgba(15, 23, 42, 0.08);
        }
        .btn:active {
          transform: translateY(1px);
        }
        .btnDanger {
          border-color: rgba(239, 68, 68, 0.35);
          color: var(--danger);
          background: #fff;
        }
        .btnDanger:hover {
          box-shadow: 0 10px 24px rgba(239, 68, 68, 0.12);
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
          padding: 16px;
        }

        .h1 {
          margin: 0;
          font-size: 18px;
          font-weight: 950;
          letter-spacing: -0.03em;
        }
        .p {
          margin: 6px 0 0;
          color: var(--muted);
          font-size: 13px;
          font-weight: 700;
          line-height: 1.55;
        }

        .notice {
          margin-top: 12px;
          background: #fff1f2;
          border: 1px solid #fecdd3;
          color: #9f1239;
          padding: 12px;
          border-radius: 14px;
          font-weight: 800;
        }

        .formGrid {
          display: grid;
          gap: 10px;
          grid-template-columns: repeat(4, minmax(0, 1fr));
        }
        @media (max-width: 980px) {
          .page {
            grid-template-columns: 1fr;
          }
          .sidebar {
            position: relative;
            top: 0;
          }
          .formGrid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }
        @media (max-width: 560px) {
          .formGrid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>

      <div className="page">
        {/* ===== Sidebar ===== */}
        <aside className="sidebar">
          {/* ✅ CLEAN HEADER: cuma avatar + nama */}
          <div className="sideHead">
            <div className="profile">
              <div className="avatar">{initialsFromName(meName)}</div>
              <div className="pText">
                <div className="pName" title={meName}>
                  {meName}
                </div>
                <div className="pRole">Admin Cabang</div>
              </div>
            </div>
          </div>

          <div className="sideNav">
            <button
              onClick={() => setTab("siswa")}
              className={`navBtn ${tab === "siswa" ? "navBtnActive" : ""}`}
              type="button"
            >
              <div className="navLeft">
                <div className="navIcon">👩‍🎓</div>
                <div className="navTitle">
                  <b>Siswa</b>
                  <span>Tambah & kelola siswa</span>
                </div>
              </div>
              <span className="count">{students.length}</span>
            </button>

            <button
              onClick={() => setTab("pembayaran")}
              className={`navBtn ${tab === "pembayaran" ? "navBtnActive" : ""}`}
              type="button"
            >
              <div className="navLeft">
                <div className="navIcon">💳</div>
                <div className="navTitle">
                  <b>Pembayaran</b>
                  <span>Approve / Reject</span>
                </div>
              </div>
              <span className="count">{payments.length}</span>
            </button>

            <button
              onClick={() => {
                if (tab === "siswa") loadStudents();
                else loadPayments();
              }}
              className="btn"
              type="button"
            >
              {loading ? "Memuat..." : "Refresh"}
            </button>
          </div>

          <div className="sideFooter">
            <button className="btn btnDanger" onClick={onLogout} type="button">
              Logout
            </button>
          </div>
        </aside>

        {/* ===== Content ===== */}
        <main className="content">
          {err ? <div className="notice">⚠️ {err}</div> : null}

          <div className="card">
            {loading ? (
              <div style={{ padding: 10, color: "#667085", fontWeight: 800 }}>
                Loading…
              </div>
            ) : tab === "siswa" ? (
              <>
                <div className="h1">Tambah & Kelola Siswa</div>
                <div className="p">
                  Buat akun siswa untuk cabang ini. Siswa login menggunakan{" "}
                  <b>Username</b>.
                </div>

                {/* Form tambah siswa */}
                <div
                  style={{
                    marginTop: 14,
                    padding: 14,
                    borderRadius: 16,
                    border: "1px solid #e5e7eb",
                    background: "#f9fafb",
                  }}
                >
                  <div
                    style={{
                      fontSize: 14.5,
                      fontWeight: 950,
                      marginBottom: 10,
                      letterSpacing: "-0.02em",
                    }}
                  >
                    Tambah Siswa Cabang
                  </div>

                  <div className="formGrid">
                    <Field
                      label="Username"
                      value={username}
                      onChange={setUsername}
                      placeholder="contoh: 0001 / rafi01"
                    />
                    <Field
                      label="Nama"
                      value={nama}
                      onChange={setNama}
                      placeholder="Nama siswa"
                    />
                    <Field
                      label="Nomer HP"
                      value={phone}
                      onChange={setPhone}
                      placeholder="contoh: 08123456789"
                    />
                    <Field
                      label="Password awal"
                      value={password}
                      onChange={setPassword}
                      placeholder="min 6 karakter"
                      type="password"
                    />
                  </div>

                  <div
                    style={{
                      marginTop: 12,
                      display: "flex",
                      gap: 10,
                      flexWrap: "wrap",
                    }}
                  >
                    <button
                      onClick={createStudent}
                      disabled={saving}
                      style={{
                        borderRadius: 12,
                        padding: "10px 14px",
                        background: "#2563eb",
                        border: "1px solid #2563eb",
                        color: "white",
                        fontWeight: 950,
                        cursor: saving ? "not-allowed" : "pointer",
                        opacity: saving ? 0.7 : 1,
                      }}
                    >
                      {saving ? "Menyimpan..." : "Tambah Siswa"}
                    </button>

                    <button
                      onClick={loadStudents}
                      style={{
                        borderRadius: 12,
                        padding: "10px 14px",
                        background: "#fff",
                        border: "1px solid #e5e7eb",
                        color: "#111827",
                        fontWeight: 900,
                        cursor: "pointer",
                      }}
                    >
                      Refresh Data
                    </button>
                  </div>

                  <div
                    style={{
                      marginTop: 8,
                      color: "#667085",
                      fontSize: 12,
                      fontWeight: 700,
                    }}
                  >
                    Catatan: siswa login menggunakan <b>Username</b> di atas.
                  </div>
                </div>

                <div style={{ marginTop: 14 }}>
                  <StudentsTable rows={students} onRowClick={openDetail} />
                </div>
              </>
            ) : (
              <>
                <div className="h1">Approval Pembayaran Cabang</div>
                <div className="p">
                  Kelola pembayaran siswa pada cabang ini.
                </div>

                <div style={{ marginTop: 14 }}>
                  <PaymentsTable rows={payments} onApprove={approve} />
                </div>
              </>
            )}
          </div>
        </main>
      </div>

      {/* Modal detail */}
      {open ? (
        <div
          onClick={() => setOpen(false)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, .35)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
            zIndex: 50,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "100%",
              maxWidth: 560,
              background: "white",
              borderRadius: 16,
              boxShadow: "0 18px 60px rgba(0,0,0,.18)",
              border: "1px solid #e5e7eb",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                padding: 14,
                borderBottom: "1px solid #eef2f7",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 10,
              }}
            >
              <div
                style={{
                  fontWeight: 950,
                  fontSize: 16,
                  letterSpacing: "-0.02em",
                }}
              >
                Detail Siswa
              </div>
              <button
                onClick={() => setOpen(false)}
                style={{
                  borderRadius: 10,
                  padding: "8px 10px",
                  background: "#fff",
                  border: "1px solid #e5e7eb",
                  fontWeight: 900,
                  cursor: "pointer",
                }}
              >
                Tutup
              </button>
            </div>

            <div style={{ padding: 14 }}>
              {detailLoading ? (
                <div style={{ color: "#667085", fontWeight: 800 }}>
                  Memuat detail…
                </div>
              ) : !detail ? (
                <div style={{ color: "#9f1239", fontWeight: 900 }}>
                  Detail tidak tersedia.
                </div>
              ) : (
                <div style={{ display: "grid", gap: 10 }}>
                  <InfoRow label="Username" value={detail.username} />
                  <InfoRow label="Nama" value={detail.nama} />
                  <InfoRow label="Nomer HP" value={detail.phone || "-"} />
                  <InfoRow
                    label="Status"
                    value={detail.is_active ? "Aktif" : "Nonaktif"}
                  />
                  <InfoRow
                    label="Dibuat"
                    value={
                      detail.created_at
                        ? new Date(detail.created_at).toLocaleString("id-ID")
                        : "-"
                    }
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "140px 1fr",
        gap: 10,
        padding: 10,
        borderRadius: 12,
        border: "1px solid #eef2f7",
        background: "#fafafa",
      }}
    >
      <div style={{ color: "#475569", fontWeight: 950, fontSize: 13 }}>
        {label}
      </div>
      <div style={{ fontWeight: 900, color: "#111827" }}>{value}</div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  type,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <div>
      <div
        style={{
          fontSize: 12,
          fontWeight: 900,
          color: "#475569",
          marginBottom: 6,
        }}
      >
        {label}
      </div>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        type={type || "text"}
        style={{
          width: "100%",
          borderRadius: 12,
          padding: "10px 12px",
          border: "1px solid #e5e7eb",
          outline: "none",
          fontWeight: 800,
          background: "white",
        }}
      />
    </div>
  );
}

function StudentsTable({
  rows,
  onRowClick,
}: {
  rows: StudentRow[];
  onRowClick: (id: string) => void;
}) {
  return (
    <div>
      <div
        style={{
          fontSize: 16,
          fontWeight: 950,
          marginBottom: 10,
          letterSpacing: "-0.02em",
        }}
      >
        Daftar Siswa Cabang
      </div>

      <div style={{ overflowX: "auto" }}>
        <table
          style={{ width: "100%", borderCollapse: "collapse", minWidth: 560 }}
        >
          <thead>
            <tr style={{ textAlign: "left", color: "#667085", fontSize: 13 }}>
              <th style={th}>Username</th>
              <th style={th}>Nama</th>
              <th style={th}>Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={3}
                  style={{ padding: 14, color: "#667085", fontWeight: 800 }}
                >
                  Belum ada siswa untuk cabang ini.
                </td>
              </tr>
            ) : (
              rows.map((s) => (
                <tr
                  key={s.id}
                  onClick={() => onRowClick(s.id)}
                  style={{
                    borderTop: "1px solid #f1f5f9",
                    cursor: "pointer",
                  }}
                >
                  <td style={tdStrong}>{s.username}</td>
                  <td style={td}>{s.nama}</td>
                  <td style={td}>
                    <span style={badge(s.is_active ? "aktif" : "nonaktif")}>
                      {s.is_active ? "Aktif" : "Nonaktif"}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div
        style={{
          marginTop: 8,
          color: "#667085",
          fontSize: 12,
          fontWeight: 700,
        }}
      >
        Tips: klik baris siswa untuk melihat detail.
      </div>
    </div>
  );
}

function PaymentsTable({
  rows,
  onApprove,
}: {
  rows: any[];
  onApprove: (id: string, st: "APPROVED" | "REJECTED") => void;
}) {
  return (
    <div>
      <div
        style={{
          fontSize: 16,
          fontWeight: 950,
          marginBottom: 10,
          letterSpacing: "-0.02em",
        }}
      >
        Data Pembayaran
      </div>

      <div style={{ overflowX: "auto" }}>
        <table
          style={{ width: "100%", borderCollapse: "collapse", minWidth: 760 }}
        >
          <thead>
            <tr style={{ textAlign: "left", color: "#667085", fontSize: 13 }}>
              <th style={th}>NIS</th>
              <th style={th}>Nama</th>
              <th style={th}>Nominal</th>
              <th style={th}>Status</th>
              <th style={th}>Aksi</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={5}
                  style={{ padding: 14, color: "#667085", fontWeight: 800 }}
                >
                  Belum ada data pembayaran untuk cabang ini.
                </td>
              </tr>
            ) : (
              rows.map((p) => (
                <tr key={p.id} style={{ borderTop: "1px solid #f1f5f9" }}>
                  <td style={tdStrong}>{p.nis || "-"}</td>
                  <td style={td}>{p.student_name || "-"}</td>
                  <td style={td}>
                    {typeof p.amount === "number"
                      ? p.amount.toLocaleString("id-ID")
                      : "-"}
                  </td>
                  <td style={td}>
                    <span style={badge(String(p.status || "").toLowerCase())}>
                      {p.status || "-"}
                    </span>
                  </td>
                  <td style={td}>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <button
                        onClick={() => onApprove(p.id, "APPROVED")}
                        style={btnGreen}
                      >
                        Approve
                      </button>
                      <button
                        onClick={() => onApprove(p.id, "REJECTED")}
                        style={btnRed}
                      >
                        Reject
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const th: React.CSSProperties = { padding: 10, fontWeight: 800 };
const td: React.CSSProperties = {
  padding: 10,
  color: "#111827",
  fontWeight: 750,
};
const tdStrong: React.CSSProperties = { padding: 10, fontWeight: 950 };

function badge(kind: string): React.CSSProperties {
  const k = kind.toLowerCase();
  const base: React.CSSProperties = {
    display: "inline-block",
    padding: "6px 10px",
    borderRadius: 999,
    fontWeight: 900,
    fontSize: 12,
    border: "1px solid transparent",
    letterSpacing: "-0.01em",
  };

  if (k.includes("approve") || k === "aktif") {
    return {
      ...base,
      background: "#ecfdf5",
      borderColor: "#a7f3d0",
      color: "#065f46",
    };
  }
  if (k.includes("reject") || k.includes("non")) {
    return {
      ...base,
      background: "#fff1f2",
      borderColor: "#fecdd3",
      color: "#9f1239",
    };
  }
  return {
    ...base,
    background: "#eff6ff",
    borderColor: "#bfdbfe",
    color: "#1d4ed8",
  };
}

const btnGreen: React.CSSProperties = {
  borderRadius: 10,
  padding: "8px 10px",
  border: "1px solid #bbf7d0",
  background: "#ecfdf5",
  color: "#065f46",
  fontWeight: 900,
  cursor: "pointer",
};

const btnRed: React.CSSProperties = {
  borderRadius: 10,
  padding: "8px 10px",
  border: "1px solid #fecaca",
  background: "#fff1f2",
  color: "#9f1239",
  fontWeight: 900,
  cursor: "pointer",
};
