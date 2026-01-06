"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type StudentRow = {
  id: string;
  username: string; // mapping dari students.nis
  nama: string; // mapping dari students.nama
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

    // normalisasi output supaya aman
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
      body: JSON.stringify({
        username,
        nama,
        phone,
        password,
      }),
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
    loadMe();
    loadBranchMe();
    loadStudents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (tab === "siswa") loadStudents();
    else loadPayments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  const title = useMemo(() => {
    const nm = me?.name ? ` — ${me.name}` : "";
    return `Panel Admin Cabang${nm}`;
  }, [me]);

  const branchLabel = useMemo(() => {
    if (!branch) return "Login Cabang: (memuat...)";
    const name = branch?.name || "-";
    const code = branch?.code ? ` (${branch.code})` : "";
    return `Login Cabang: ${name}${code}`;
  }, [branch]);

  return (
    <div>
      {/* Header */}
      <div
        style={{
          background: "white",
          borderRadius: 16,
          padding: 16,
          boxShadow: "0 8px 30px rgba(0,0,0,.06)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <div>
          <div style={{ fontSize: 18, fontWeight: 800 }}>{title}</div>
          <div style={{ color: "#667085", marginTop: 4, fontSize: 13 }}>
            Data yang tampil otomatis terfilter berdasarkan cabang akun ini.
          </div>
          <div
            style={{
              color: "#1d4ed8",
              marginTop: 6,
              fontSize: 13,
              fontWeight: 800,
            }}
          >
            {branchLabel}
          </div>
        </div>

        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={() => setTab("siswa")} style={pill(tab === "siswa")}>
            Siswa
          </button>
          <button
            onClick={() => setTab("pembayaran")}
            style={pill(tab === "pembayaran")}
          >
            Pembayaran
          </button>

          <button
            onClick={async () => {
              await fetch("/api/auth/logout", { method: "POST" }).catch(
                () => {}
              );
              router.push("/login");
            }}
            style={{
              borderRadius: 12,
              padding: "10px 14px",
              background: "#fff",
              border: "1px solid #fecaca",
              color: "#ef4444",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Logout
          </button>
        </div>
      </div>

      {/* Error */}
      {err ? (
        <div
          style={{
            marginTop: 14,
            background: "#fff1f2",
            border: "1px solid #fecdd3",
            color: "#9f1239",
            padding: 12,
            borderRadius: 12,
            fontWeight: 600,
          }}
        >
          ⚠️ {err}
        </div>
      ) : null}

      {/* Content */}
      <div
        style={{
          marginTop: 14,
          background: "white",
          borderRadius: 16,
          padding: 16,
          boxShadow: "0 8px 30px rgba(0,0,0,.06)",
        }}
      >
        {loading ? (
          <div style={{ padding: 10, color: "#667085" }}>Loading…</div>
        ) : tab === "siswa" ? (
          <>
            {/* Form tambah siswa (sesuai permintaan) */}
            <div
              style={{
                padding: 14,
                borderRadius: 14,
                border: "1px solid #e5e7eb",
                background: "#f9fafb",
                marginBottom: 14,
              }}
            >
              <div style={{ fontSize: 15, fontWeight: 900, marginBottom: 10 }}>
                Tambah Siswa Cabang
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
                  gap: 10,
                }}
              >
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

              <div style={{ marginTop: 12, display: "flex", gap: 10 }}>
                <button
                  onClick={createStudent}
                  disabled={saving}
                  style={{
                    borderRadius: 12,
                    padding: "10px 14px",
                    background: "#2563eb",
                    border: "1px solid #2563eb",
                    color: "white",
                    fontWeight: 900,
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
                    fontWeight: 800,
                    cursor: "pointer",
                  }}
                >
                  Refresh
                </button>
              </div>

              <div style={{ marginTop: 8, color: "#667085", fontSize: 12 }}>
                Catatan: siswa login menggunakan <b>Username</b> di atas.
              </div>
            </div>

            <StudentsTable
              rows={students}
              onRowClick={(id) => openDetail(id)}
            />
          </>
        ) : (
          <PaymentsTable rows={payments} onApprove={approve} />
        )}
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
              <div style={{ fontWeight: 900, fontSize: 16 }}>Detail Siswa</div>
              <button
                onClick={() => setOpen(false)}
                style={{
                  borderRadius: 10,
                  padding: "8px 10px",
                  background: "#fff",
                  border: "1px solid #e5e7eb",
                  fontWeight: 800,
                  cursor: "pointer",
                }}
              >
                Tutup
              </button>
            </div>

            <div style={{ padding: 14 }}>
              {detailLoading ? (
                <div style={{ color: "#667085" }}>Memuat detail…</div>
              ) : !detail ? (
                <div style={{ color: "#9f1239", fontWeight: 700 }}>
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
    </div>
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
      <div style={{ color: "#475569", fontWeight: 900, fontSize: 13 }}>
        {label}
      </div>
      <div style={{ fontWeight: 800, color: "#111827" }}>{value}</div>
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
          fontWeight: 800,
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
          fontWeight: 700,
          background: "white",
        }}
      />
    </div>
  );
}

function pill(active: boolean): React.CSSProperties {
  return {
    borderRadius: 12,
    padding: "10px 14px",
    background: active ? "#2563eb" : "#fff",
    border: active ? "1px solid #2563eb" : "1px solid #e5e7eb",
    color: active ? "white" : "#111827",
    fontWeight: 800,
    cursor: "pointer",
  };
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
      <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 10 }}>
        Daftar Siswa Cabang
      </div>

      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
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
                <td colSpan={3} style={{ padding: 14, color: "#667085" }}>
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

      <div style={{ marginTop: 8, color: "#667085", fontSize: 12 }}>
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
      <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 10 }}>
        Approval Pembayaran Cabang
      </div>

      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
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
                <td colSpan={5} style={{ padding: 14, color: "#667085" }}>
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
                    <div style={{ display: "flex", gap: 8 }}>
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

const th: React.CSSProperties = { padding: 10, fontWeight: 700 };
const td: React.CSSProperties = { padding: 10, color: "#111827" };
const tdStrong: React.CSSProperties = { padding: 10, fontWeight: 800 };

function badge(kind: string): React.CSSProperties {
  const k = kind.toLowerCase();
  const base: React.CSSProperties = {
    display: "inline-block",
    padding: "6px 10px",
    borderRadius: 999,
    fontWeight: 800,
    fontSize: 12,
    border: "1px solid transparent",
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
  means: undefined,
  color: "#065f46",
  fontWeight: 800,
  cursor: "pointer",
} as any;

const btnRed: React.CSSProperties = {
  borderRadius: 10,
  padding: "8px 10px",
  border: "1px solid #fecaca",
  background: "#fff1f2",
  color: "#9f1239",
  fontWeight: 800,
  cursor: "pointer",
};
