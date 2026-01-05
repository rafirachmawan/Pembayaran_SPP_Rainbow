"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";

// ✅ Logo dari src/assets/rainbow.jpeg
import rainbowLogo from "../../assets/rainbow.jpeg";

type Prize = {
  id: string;
  label: string;
  type: "FIXED" | "PERCENT" | "NONE";
  value: number;
  quota: number;
  used: number;
  active: boolean;
  weight?: number; // ✅ bobot peluang (semakin besar semakin sering keluar)
  created_at?: string;
};

type Student = {
  id?: string;
  nis: string;
  nama: string;
  kelas: string;
  username?: string;
  created_at?: string;
  is_active?: boolean;
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

type StudentPaymentDetail = {
  current?: {
    period?: string;
    status?: string;
    base_amount?: number;
    discount_amount?: number;
    final_amount?: number;
    paid_at?: string | null;
    method?: string | null;
    ref?: string | null;
  } | null;
  history?: PaymentRow[];
};

/** =========================
 * ✅ Multi Cabang (tambahan)
 * ========================= */
type Role = "superadmin" | "admin_cabang" | string;

type Branch = {
  id: string;
  code: string; // misal: CAB-A / TGA-01
  name: string; // misal: Cabang Tulungagung
  address?: string | null;
  is_active?: boolean;
  created_at?: string;
};

type BranchAdmin = {
  id: string;
  username: string;
  name?: string | null;
  branch_id: string;
  branch_name?: string | null;
  is_active?: boolean;
  created_at?: string;
};

type PendingPayment = {
  id: string;
  student_id?: string | null;
  nis?: string | null;
  student_name?: string | null;
  kelas?: string | null;
  period: string;
  amount: number;
  status: "PENDING" | string;
  requested_at?: string | null;
  method?: string | null;
  ref?: string | null;
  // optional branch context
  branch_id?: string | null;
};

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

function formatHadiah(p: Prize) {
  if (p.type === "NONE") return "Zonk";
  if (p.type === "PERCENT") return `${p.value}%`;
  return `Rp ${Number(p.value).toLocaleString("id-ID")}`;
}

/** ✅ 4 digit: 0001, 0002, ... */
function pad4(n: number) {
  return String(n).padStart(4, "0");
}

/**
 * ✅ hitung NIS berikutnya:
 * - hanya hitung NIS numeric 1..9999 (max 4 digit)
 * - abaikan NIS lama yang 5-6 digit (misal 123457)
 * - jika belum ada NIS 4 digit, mulai 0001
 */
function calcNextNis(students: Student[]) {
  let max = 0;

  for (const s of students || []) {
    const raw = String(s.nis ?? "").trim();
    if (!raw) continue;

    if (/^\d+$/.test(raw)) {
      const v = Number(raw);
      if (Number.isFinite(v) && v >= 1 && v <= 9999) {
        if (v > max) max = v;
      }
    }
  }

  return pad4(max + 1);
}

/**
 * ✅ hitung peluang keluar per hadiah (berdasarkan weight)
 * Konsep:
 * - hadiah dianggap eligible jika: active && sisa>0 && weight>0
 * - peluang (%) = weight / totalWeight * 100
 * Catatan: kuota tetap pembatas (kalau sisa=0, peluang 0%)
 */
function buildChanceMap(prizes: Prize[]) {
  const eligible = (prizes || [])
    .map((p) => {
      const w = Number(p.weight ?? 1);
      const sisa = Math.max(0, Number(p.quota) - Number(p.used));
      return { ...p, _w: Number.isFinite(w) ? w : 1, _sisa: sisa };
    })
    .filter((p) => !!p.active && p._sisa > 0 && p._w > 0);

  const totalW = eligible.reduce((a, p) => a + p._w, 0);

  const map: Record<string, number> = {};
  for (const p of prizes || []) {
    map[p.id] = 0;
  }

  if (totalW <= 0) return { map, totalW };

  for (const p of eligible) {
    map[p.id] = (p._w / totalW) * 100;
  }

  return { map, totalW };
}

type SectionKey =
  | "dashboard"
  | "setSpp"
  | "addPrize"
  | "listPrize"
  | "addStudent"
  | "listStudent"
  // ✅ tambahan superadmin
  | "branchList"
  | "branchAdd"
  | "branchAdmins"
  // ✅ tambahan admin cabang
  | "approvalSpp";

export default function AdminPage() {
  // ✅ cegah hydration mismatch
  const [mounted, setMounted] = useState(false);

  /** =========================
   * ✅ Auth context (role & cabang)
   * - tidak mengubah logika existing, hanya menambahkan kontrol menu & filter cabang
   * ========================= */
  const [role, setRole] = useState<Role>("superadmin");
  const [myBranchId, setMyBranchId] = useState<string | null>(null);

  // superadmin bisa memilih cabang untuk dikelola (opsional)
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loadingBranches, setLoadingBranches] = useState(false);
  const [activeBranchId, setActiveBranchId] = useState<string | null>(null);

  // form tambah cabang
  const [branchCode, setBranchCode] = useState("CAB-01");
  const [branchName, setBranchName] = useState("Cabang Utama");
  const [branchAddress, setBranchAddress] = useState("Tulungagung");

  // admin cabang
  const [admins, setAdmins] = useState<BranchAdmin[]>([]);
  const [loadingAdmins, setLoadingAdmins] = useState(false);
  const [adminUsername, setAdminUsername] = useState("admin.cabang");
  const [adminName, setAdminName] = useState("Admin Cabang");
  const [adminPass, setAdminPass] = useState("123456");
  const [adminDeletingId, setAdminDeletingId] = useState<string | null>(null);

  // approval spp (admin cabang)
  const [pendingPayments, setPendingPayments] = useState<PendingPayment[]>([]);
  const [loadingPending, setLoadingPending] = useState(false);
  const [actingPaymentId, setActingPaymentId] = useState<string | null>(null);
  const [pendingQ, setPendingQ] = useState("");

  const [period, setPeriod] = useState("2025-12");
  const [amount, setAmount] = useState(200000);
  const [deadline, setDeadline] = useState(11);

  // tambah hadiah
  const [label, setLabel] = useState("Diskon 10rb");
  const [type, setType] = useState<"FIXED" | "PERCENT" | "NONE">("FIXED");
  const [value, setValue] = useState(10000);
  const [quota, setQuota] = useState(50);
  const [weight, setWeight] = useState(1); // ✅ bobot peluang hadiah (default 1)

  // list hadiah
  const [prizes, setPrizes] = useState<Prize[]>([]);
  const [loadingList, setLoadingList] = useState(false);
  const [clearingPrizes, setClearingPrizes] = useState(false);

  // tambah siswa
  const [nis, setNis] = useState("0001"); // ✅ default 0001
  const [nama, setNama] = useState("Nama Siswa");
  const [kelas, setKelas] = useState("X-A");
  const [pass, setPass] = useState("123456");

  // list siswa
  const [students, setStudents] = useState<Student[]>([]);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [studentQ, setStudentQ] = useState("");
  const [deletingStudentId, setDeletingStudentId] = useState<string | null>(
    null
  );

  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(
    null
  );

  const [activeSection, setActiveSection] = useState<SectionKey>("dashboard");

  const periodLabel = useMemo(() => formatPeriode(period), [period]);

  // ✅ DETAIL pembayaran siswa (modal)
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [studentPayDetail, setStudentPayDetail] =
    useState<StudentPaymentDetail | null>(null);
  const [detailErr, setDetailErr] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    location.href = "/login";
  }

  /** =========================
   * ✅ helper query params cabang
   * ========================= */
  function branchQs(qs?: URLSearchParams) {
    const p = qs || new URLSearchParams();
    // superadmin: pakai activeBranchId kalau dipilih
    // admin cabang: pakai myBranchId (dikunci)
    const bid = role === "admin_cabang" ? myBranchId : activeBranchId;
    if (bid) p.set("branch_id", bid);
    return p;
  }

  /** =========================
   * ✅ Load Me (role & cabang) — additive saja
   * Endpoint disiapkan di backend:
   * GET /api/auth/me -> { role, branch_id }
   * Kalau endpoint belum ada, fallback superadmin (tidak merusak logic)
   * ========================= */
  async function loadMe() {
    try {
      const res = await fetch("/api/auth/me", { method: "GET" });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) return;

      const r = String(d?.role || "").toLowerCase();
      const bid = d?.branch_id ? String(d.branch_id) : null;

      if (r) setRole(r as Role);
      if (bid) setMyBranchId(bid);

      // default activeBranch:
      // - admin cabang otomatis pakai cabangnya
      // - superadmin biarkan null dulu (atau set pertama setelah loadBranches)
      if (r === "admin_cabang" && bid) {
        setActiveBranchId(bid);
      }
    } catch {
      // ignore (fallback superadmin)
    }
  }

  /** =========================
   * ✅ Cabang (superadmin)
   * Endpoint (kita pakai /api/admin/* sesuai project kamu sekarang):
   * GET    /api/admin/branches/list
   * POST   /api/admin/branches/create  { code, name, address }
   * DELETE /api/admin/branches/delete?id=
   * ========================= */
  async function loadBranches() {
    setLoadingBranches(true);
    const res = await fetch("/api/admin/branches/list");
    const d = await res.json().catch(() => ({}));
    setLoadingBranches(false);

    if (!res.ok) {
      setMsg({ type: "err", text: d?.error || "Gagal ambil list cabang" });
      setBranches([]);
      return;
    }

    const rows = Array.isArray(d?.branches) ? d.branches : [];
    setBranches(rows);

    // superadmin: kalau belum pilih cabang, set ke cabang pertama biar enak
    if (role !== "admin_cabang") {
      if (!activeBranchId && rows?.[0]?.id) {
        setActiveBranchId(String(rows[0].id));
      }
    }
  }

  async function addBranch() {
    setMsg(null);
    const res = await fetch("/api/admin/branches/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code: branchCode,
        name: branchName,
        address: branchAddress,
      }),
    });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) {
      return setMsg({ type: "err", text: d?.error || "Gagal tambah cabang" });
    }
    setMsg({ type: "ok", text: `Cabang dibuat: ${d?.branch?.name || "-"}` });
    await loadBranches();
  }

  async function deleteBranch(id: string) {
    const ok = confirm(
      "Yakin hapus cabang ini?\n\nCatatan: pastikan tidak ada admin/siswa terkait."
    );
    if (!ok) return;

    setMsg(null);
    // ✅ (FIX) pakai endpoint admin yang memang ada di project kamu sekarang
    const res = await fetch(
      `/api/admin/branches/delete?id=${encodeURIComponent(id)}`,
      { method: "DELETE" }
    );
    const d = await res.json().catch(() => ({}));
    if (!res.ok) {
      return setMsg({ type: "err", text: d?.error || "Gagal hapus cabang" });
    }
    setMsg({ type: "ok", text: "Cabang berhasil dihapus" });

    // kalau yang dihapus adalah cabang terpilih, reset
    if (activeBranchId === id) setActiveBranchId(null);

    await loadBranches();
  }

  /** =========================
   * ✅ Admin Cabang (superadmin)
   * Endpoint (kita pakai /api/admin/* supaya gak 404 lagi):
   * GET    /api/admin/branch-admins/list?branch_id=
   * POST   /api/admin/branch-admins/create { branch_id, username, name, password }
   * DELETE /api/admin/branch-admins/delete?id=
   * ========================= */
  async function loadBranchAdmins() {
    setLoadingAdmins(true);

    const qs = branchQs(new URLSearchParams());
    // ✅ (FIX) endpoint admin
    const res = await fetch(`/api/admin/branch-admins/list?${qs}`);
    const d = await res.json().catch(() => ({}));
    setLoadingAdmins(false);

    if (!res.ok) {
      setMsg({
        type: "err",
        text: d?.error || "Gagal ambil list admin cabang",
      });
      setAdmins([]);
      return;
    }

    setAdmins(Array.isArray(d?.admins) ? d.admins : []);
  }

  async function addBranchAdmin() {
    if (!activeBranchId) {
      return setMsg({
        type: "err",
        text: "Pilih cabang dulu untuk membuat admin cabang.",
      });
    }

    setMsg(null);
    // ✅ (FIX) endpoint admin
    const res = await fetch("/api/admin/branch-admins/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        branch_id: activeBranchId,
        username: adminUsername,
        name: adminName,
        password: adminPass,
      }),
    });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) {
      return setMsg({
        type: "err",
        text: d?.error || "Gagal tambah admin cabang",
      });
    }

    setMsg({
      type: "ok",
      text: `Admin cabang dibuat: ${d?.username || adminUsername}`,
    });
    await loadBranchAdmins();
  }

  async function deleteBranchAdmin(a: BranchAdmin) {
    const ok = confirm(
      `Yakin hapus admin cabang ini?\n\n${a.username} • ${
        a.branch_name || a.branch_id
      }`
    );
    if (!ok) return;

    setMsg(null);
    setAdminDeletingId(a.id);

    // ✅ (FIX) endpoint admin
    const res = await fetch(
      `/api/admin/branch-admins/delete?id=${encodeURIComponent(a.id)}`,
      { method: "DELETE" }
    );
    const d = await res.json().catch(() => ({}));

    setAdminDeletingId(null);

    if (!res.ok) {
      return setMsg({
        type: "err",
        text: d?.error || "Gagal hapus admin cabang",
      });
    }

    setMsg({ type: "ok", text: "Admin cabang berhasil dihapus" });
    await loadBranchAdmins();
  }

  /** =========================
   * ✅ Approval bayar SPP (admin cabang)
   * Endpoint disiapkan di backend:
   * GET  /api/cabang/payments/pending?branch_id=&q=
   * POST /api/cabang/payments/approve { payment_id }
   * POST /api/cabang/payments/reject  { payment_id }
   * ========================= */
  async function loadPendingPayments() {
    setLoadingPending(true);

    const qs = branchQs(new URLSearchParams());
    if (pendingQ.trim()) qs.set("q", pendingQ.trim());

    const res = await fetch(`/api/cabang/payments/pending?${qs}`);
    const d = await res.json().catch(() => ({}));
    setLoadingPending(false);

    if (!res.ok) {
      setMsg({
        type: "err",
        text: d?.error || "Gagal ambil pending pembayaran",
      });
      setPendingPayments([]);
      return;
    }

    setPendingPayments(Array.isArray(d?.payments) ? d.payments : []);
  }

  async function approvePayment(id: string) {
    const ok = confirm("Approve pembayaran ini?");
    if (!ok) return;

    setMsg(null);
    setActingPaymentId(id);

    const res = await fetch("/api/cabang/payments/approve", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ payment_id: id }),
    });
    const d = await res.json().catch(() => ({}));

    setActingPaymentId(null);

    if (!res.ok) {
      return setMsg({
        type: "err",
        text: d?.error || "Gagal approve pembayaran",
      });
    }

    setMsg({ type: "ok", text: "Pembayaran di-approve ✅" });
    await loadPendingPayments();
  }

  async function rejectPayment(id: string) {
    const ok = confirm("Reject pembayaran ini?");
    if (!ok) return;

    setMsg(null);
    setActingPaymentId(id);

    const res = await fetch("/api/cabang/payments/reject", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ payment_id: id }),
    });
    const d = await res.json().catch(() => ({}));

    setActingPaymentId(null);

    if (!res.ok) {
      return setMsg({
        type: "err",
        text: d?.error || "Gagal reject pembayaran",
      });
    }

    setMsg({ type: "ok", text: "Pembayaran di-reject 🧾" });
    await loadPendingPayments();
  }

  async function loadPrizes() {
    setLoadingList(true);

    // ✅ tetap endpoint lama, hanya menambahkan branch_id jika ada (tidak mengubah logic inti)
    const qs = branchQs(new URLSearchParams());
    qs.set("period", period);

    const res = await fetch(`/api/admin/spin-prizes/list?${qs.toString()}`);
    const d = await res.json().catch(() => ({}));
    setLoadingList(false);

    if (!res.ok) {
      setMsg({ type: "err", text: d?.error || "Gagal ambil list hadiah" });
      setPrizes([]);
      return;
    }
    setPrizes(Array.isArray(d.prizes) ? d.prizes : []);
  }

  async function setSpp() {
    setMsg(null);

    const body: any = { period, amount, spin_deadline_day: deadline };
    // ✅ kirim branch_id opsional
    const bid = role === "admin_cabang" ? myBranchId : activeBranchId;
    if (bid) body.branch_id = bid;

    const res = await fetch("/api/admin/spp/set", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const d = await res.json().catch(() => ({}));
    if (!res.ok)
      return setMsg({ type: "err", text: d?.error || "Gagal set SPP" });

    setMsg({
      type: "ok",
      text: `SPP aktif: ${formatPeriode(d.period.period)} • Rp ${Number(
        d.period.amount
      ).toLocaleString("id-ID")}`,
    });
  }

  async function addPrize() {
    setMsg(null);

    const body: any = { period, label, type, value, quota, weight };
    const bid = role === "admin_cabang" ? myBranchId : activeBranchId;
    if (bid) body.branch_id = bid;

    const res = await fetch("/api/admin/spin-prizes/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      // ✅ kirim weight ke backend
      body: JSON.stringify(body),
    });
    const d = await res.json().catch(() => ({}));
    if (!res.ok)
      return setMsg({ type: "err", text: d?.error || "Gagal tambah hadiah" });

    setMsg({ type: "ok", text: `Hadiah ditambah: ${d.prize.label}` });
    await loadPrizes();
  }

  async function deletePrize(id: string) {
    const ok = confirm("Yakin hapus hadiah ini?");
    if (!ok) return;

    setMsg(null);

    const qs = branchQs(new URLSearchParams());
    qs.set("id", id);

    const res = await fetch(`/api/admin/spin-prizes/delete?${qs.toString()}`, {
      method: "DELETE",
    });
    const d = await res.json().catch(() => ({}));
    if (!res.ok)
      return setMsg({ type: "err", text: d?.error || "Gagal hapus hadiah" });

    setMsg({ type: "ok", text: "Hadiah berhasil dihapus" });
    await loadPrizes();
  }

  // ✅ HAPUS SEMUA HADIAH PERIODE
  async function clearPrizes() {
    const ok = confirm(
      `Yakin hapus SEMUA hadiah untuk periode ${formatPeriode(period)}?`
    );
    if (!ok) return;

    setMsg(null);
    setClearingPrizes(true);

    const qs = branchQs(new URLSearchParams());
    qs.set("period", period);

    const res = await fetch(`/api/admin/spin-prizes/clear?${qs.toString()}`, {
      method: "DELETE",
    });
    const d = await res.json().catch(() => ({}));
    setClearingPrizes(false);

    if (!res.ok) {
      return setMsg({
        type: "err",
        text: d?.error || "Gagal hapus semua hadiah",
      });
    }

    setMsg({ type: "ok", text: "Semua hadiah periode ini berhasil dihapus" });
    await loadPrizes();
  }

  async function loadStudents() {
    setLoadingStudents(true);

    const qs = branchQs(new URLSearchParams());
    if (studentQ) qs.set("q", studentQ);

    const res = await fetch(`/api/admin/students/list?${qs.toString()}`);
    const d = await res.json().catch(() => ({}));
    setLoadingStudents(false);

    if (!res.ok) {
      setMsg({ type: "err", text: d?.error || "Gagal ambil list siswa" });
      setStudents([]);
      return;
    }
    setStudents(Array.isArray(d.students) ? d.students : []);
  }

  async function addStudent() {
    setMsg(null);

    const body: any = { nis, nama, kelas, password: pass };
    const bid = role === "admin_cabang" ? myBranchId : activeBranchId;
    if (bid) body.branch_id = bid;

    const res = await fetch("/api/admin/students/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const d = await res.json().catch(() => ({}));
    if (!res.ok)
      return setMsg({ type: "err", text: d?.error || "Gagal tambah siswa" });

    setMsg({
      type: "ok",
      text: `Akun siswa dibuat: ${d.username} / ${d.password}`,
    });

    await loadStudents(); // ✅ refresh biar langsung muncul & nis naik
  }

  // ✅ HAPUS SISWA (baris tabel / modal)
  async function deleteStudent(s: Student) {
    const ok = confirm(
      `Yakin hapus siswa ini?\n\n${s.nama} • NIS ${s.nis}\n\nCatatan: akun siswa + data siswa akan dihapus.`
    );
    if (!ok) return;

    setMsg(null);
    setDeletingStudentId(String(s.id || s.nis));

    const qs = branchQs(new URLSearchParams());
    if (s.id) qs.set("student_id", s.id);
    qs.set("nis", s.nis);

    const res = await fetch(`/api/admin/students/delete?${qs.toString()}`, {
      method: "DELETE",
    });
    const d = await res.json().catch(() => ({}));

    setDeletingStudentId(null);

    if (!res.ok) {
      return setMsg({ type: "err", text: d?.error || "Gagal hapus siswa" });
    }

    setMsg({ type: "ok", text: "Siswa berhasil dihapus" });

    // kalau modal sedang terbuka untuk siswa yang sama, tutup biar aman
    if (selectedStudent?.nis === s.nis) {
      closeDetail();
    }

    await loadStudents();
  }

  // ✅ klik siswa -> buka modal & load pembayaran
  async function openStudentPayments(s: Student) {
    setSelectedStudent(s);
    setDetailOpen(true);
    setDetailErr(null);
    setStudentPayDetail(null);
    setDetailLoading(true);

    try {
      const qs = branchQs(new URLSearchParams());
      if (s.id) qs.set("student_id", s.id);
      qs.set("nis", s.nis);

      const res = await fetch(`/api/admin/students/payments?${qs.toString()}`);
      const d = await res.json().catch(() => ({}));

      if (!res.ok) {
        setDetailErr(d?.error || "Gagal ambil detail pembayaran siswa");
        setDetailLoading(false);
        return;
      }

      const detail: StudentPaymentDetail = {
        current: d?.current ?? null,
        history: Array.isArray(d?.history)
          ? d.history
          : Array.isArray(d?.payments)
          ? d.payments
          : [],
      };

      if (Array.isArray(detail.history)) {
        const rows = [...detail.history];
        rows.sort((a, b) => {
          const ta = a.paid_at ? new Date(a.paid_at).getTime() : 0;
          const tb = b.paid_at ? new Date(b.paid_at).getTime() : 0;
          return tb - ta;
        });
        detail.history = rows;
      }

      setStudentPayDetail(detail);
      setDetailLoading(false);
    } catch (e: any) {
      setDetailErr(e?.message || "Terjadi kesalahan");
      setDetailLoading(false);
    }
  }

  function closeDetail() {
    setDetailOpen(false);
    setSelectedStudent(null);
    setStudentPayDetail(null);
    setDetailErr(null);
    setDetailLoading(false);
  }

  // ✅ init role & cabang context
  useEffect(() => {
    loadMe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ✅ load cabang kalau superadmin
  useEffect(() => {
    if (!mounted) return;
    if (role === "superadmin") {
      loadBranches();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role, mounted]);

  // reload list hadiah saat period berubah
  useEffect(() => {
    loadPrizes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period, activeBranchId, myBranchId, role]);

  // auto-load siswa saat buka addStudent / listStudent
  useEffect(() => {
    if (activeSection === "addStudent" || activeSection === "listStudent") {
      loadStudents();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSection, activeBranchId, myBranchId, role]);

  // auto-load admin cabang
  useEffect(() => {
    if (activeSection === "branchAdmins") {
      loadBranchAdmins();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSection, activeBranchId, role]);

  // auto-load cabang list saat buka menu cabang
  useEffect(() => {
    if (role === "superadmin") {
      if (activeSection === "branchList" || activeSection === "branchAdd") {
        loadBranches();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSection, role]);

  // auto-load pending approvals
  useEffect(() => {
    if (activeSection === "approvalSpp") {
      loadPendingPayments();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSection, activeBranchId, myBranchId, role]);

  // ✅ auto set NIS 0001.. saat students berubah (khusus addStudent)
  useEffect(() => {
    if (activeSection !== "addStudent") return;
    const next = calcNextNis(students);
    setNis(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [students, activeSection]);

  const totalHadiah = prizes.length;
  const totalSisa = prizes.reduce(
    (acc, p) => acc + Math.max(0, Number(p.quota) - Number(p.used)),
    0
  );

  /** =========================
   * ✅ Menu dinamis berdasarkan role
   * - superadmin: semua + cabang/admin cabang
   * - admin cabang: siswa + approval
   * ========================= */
  const menu = useMemo(() => {
    if (role === "admin_cabang") {
      return [
        { key: "dashboard" as const, label: "Dashboard" },
        { key: "addStudent" as const, label: "Tambah Siswa" },
        { key: "listStudent" as const, label: "List Siswa" },
        { key: "approvalSpp" as const, label: "Approval Bayar SPP" },
        { key: "setSpp" as const, label: "Set SPP" },
        { key: "addPrize" as const, label: "Tambah Hadiah" },
        { key: "listPrize" as const, label: "List Hadiah" },
      ];
    }

    // default: superadmin
    return [
      { key: "dashboard" as const, label: "Dashboard" },

      // ✅ cabang management
      { key: "branchList" as const, label: "List Cabang" },
      { key: "branchAdd" as const, label: "Tambah Cabang" },
      { key: "branchAdmins" as const, label: "Admin Cabang" },

      // ✅ existing
      { key: "setSpp" as const, label: "Set SPP" },
      { key: "addPrize" as const, label: "Tambah Hadiah" },
      { key: "listPrize" as const, label: "List Hadiah" },
      { key: "addStudent" as const, label: "Tambah Siswa" },
      { key: "listStudent" as const, label: "List Siswa" },
    ];
  }, [role]);

  // ✅ mencegah mismatch: render hanya setelah mounted
  // ✅ Map peluang (%) per hadiah berdasarkan weight
  const chanceInfo = useMemo(() => buildChanceMap(prizes), [prizes]);
  const chanceMap = chanceInfo.map;

  function go(section: SectionKey) {
    setActiveSection(section);
    if (typeof window !== "undefined") window.scrollTo({ top: 0 });
  }

  /** ✅ branchLabel (PINDAH KE ATAS!) */
  const branchLabel = useMemo(() => {
    const bid = role === "admin_cabang" ? myBranchId : activeBranchId;
    if (!bid) return "Semua / Belum dipilih";
    const b = branches.find((x) => String(x.id) === String(bid));
    return b ? `${b.name} (${b.code})` : `Branch: ${bid}`;
  }, [role, myBranchId, activeBranchId, branches]);

  // ✅ mencegah mismatch: render hanya setelah mounted
  if (!mounted) return null;

  // (ini bukan hook, aman setelah return)
  const currentStatus = String(
    studentPayDetail?.current?.status || ""
  ).toUpperCase();
  const currentPeriod = String(
    studentPayDetail?.current?.period || period || ""
  );
  const currentBase = Number(studentPayDetail?.current?.base_amount ?? NaN);
  const currentDisc = Number(studentPayDetail?.current?.discount_amount ?? NaN);
  const currentFinal = Number(studentPayDetail?.current?.final_amount ?? NaN);

  return (
    <>
      <style jsx global>{`
        /* ✅ Samakan font persis seperti Login */
        @import url("https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Inter:wght@400;500;600;700;800;900&display=swap");

        :root {
          --bg: #f6f8fc;
          --card: #ffffff;
          --text: #0f172a;
          --muted: #64748b;
          --line: rgba(15, 23, 42, 0.08);

          --primary: #2563eb;
          --primary-2: #1d4ed8;

          --danger: #ef4444;
          --shadow: 0 10px 30px rgba(15, 23, 42, 0.08);
          --radius: 16px;
          --radius-sm: 12px;
        }

        html,
        body {
          background: var(--bg);
          color: var(--text);
        }

        * {
          box-sizing: border-box;
        }

        /* ✅ Typography baseline (sama) */
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

        .appShell {
          min-height: 100vh;
          background: var(--bg);
        }

        .appHeader {
          position: sticky;
          top: 0;
          z-index: 40;
          background: rgba(246, 248, 252, 0.85);
          backdrop-filter: blur(12px);
          border-bottom: 1px solid var(--line);
        }

        .headerInner {
          max-width: 1400px;
          margin: 0 auto;
          padding: 14px 16px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
        }

        .brandRow {
          display: flex;
          align-items: center;
          gap: 12px;
          min-width: 240px;
        }

        .logoWrap {
          width: 44px;
          height: 44px;
          border-radius: 14px;
          overflow: hidden;
          background: #fff;
          box-shadow: 0 6px 16px rgba(15, 23, 42, 0.12);
          border: 1px solid var(--line);
          flex: 0 0 auto;
        }

        .brandText {
          display: flex;
          flex-direction: column;
          line-height: 1.05;
        }

        .brandText b {
          font-size: 15.5px;
          font-weight: 900;
          letter-spacing: -0.03em;
        }

        .brandText span {
          font-size: 12px;
          font-weight: 650;
          color: var(--muted);
          margin-top: 3px;
          letter-spacing: -0.01em;
        }

        .headerRight {
          display: flex;
          align-items: center;
          gap: 10px;
          flex-wrap: wrap;
          justify-content: flex-end;
        }

        .primaryBtn,
        .dangerBtn,
        .ghostBtn {
          height: 40px;
          padding: 0 12px;
          border-radius: 12px;
          border: 1px solid var(--line);
          background: #fff;
          color: var(--text);
          font-size: 13px;
          font-weight: 850;
          letter-spacing: -0.01em;
          display: inline-flex;
          align-items: center;
          gap: 8px;
          cursor: pointer;
          transition: transform 0.05s ease, background 0.15s ease,
            box-shadow 0.15s ease, border-color 0.15s ease;
        }
        .primaryBtn:active,
        .dangerBtn:active,
        .ghostBtn:active {
          transform: translateY(1px);
        }

        .primaryBtn {
          background: linear-gradient(180deg, var(--primary), var(--primary-2));
          border-color: rgba(37, 99, 235, 0.25);
          color: #fff;
          box-shadow: 0 14px 30px rgba(37, 99, 235, 0.18);
        }
        .primaryBtn:hover {
          filter: brightness(1.02);
        }

        .dangerBtn {
          background: #fff;
          border-color: rgba(239, 68, 68, 0.35);
          color: var(--danger);
        }
        .dangerBtn:hover {
          box-shadow: 0 10px 24px rgba(239, 68, 68, 0.12);
        }

        .ghostBtn {
          background: rgba(15, 23, 42, 0.02);
        }

        .layout {
          max-width: 1400px;
          margin: 0 auto;
          padding: 16px;
          display: grid;
          grid-template-columns: 320px 1fr;
          gap: 16px;
          align-items: start;
        }

        .sidebar {
          position: sticky;
          top: 76px;
          border-radius: var(--radius);
          background: var(--card);
          border: 1px solid var(--line);
          box-shadow: var(--shadow);
          overflow: hidden;
        }

        .sidebarTop {
          padding: 16px;
          border-bottom: 1px solid var(--line);
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
        }

        .sidebarTop h3 {
          margin: 0;
          font-size: 14px;
          font-weight: 900;
          letter-spacing: -0.02em;
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
          font-weight: 900;
          white-space: nowrap;
          letter-spacing: -0.01em;
        }

        .sideMenu {
          padding: 14px;
          display: grid;
          gap: 10px;
        }

        .menuBtn {
          height: 44px;
          border-radius: 14px;
          border: 1px solid var(--line);
          background: #fff;
          color: var(--text);
          font-weight: 900;
          font-size: 13px;
          letter-spacing: -0.01em;
          cursor: pointer;
          text-align: left;
          padding: 0 12px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          transition: box-shadow 0.15s ease, border-color 0.15s ease,
            background 0.15s ease;
        }

        .menuBtn:hover {
          box-shadow: 0 10px 24px rgba(15, 23, 42, 0.08);
        }

        .menuBtnActive {
          background: rgba(37, 99, 235, 0.1);
          border-color: rgba(37, 99, 235, 0.24);
          color: rgba(29, 78, 216, 1);
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

        .titleRow {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 10px;
          margin-bottom: 12px;
        }

        .titleRow h1,
        .titleRow h2 {
          margin: 0;
          letter-spacing: -0.03em;
          font-weight: 950;
        }

        .titleRow h1 {
          font-size: 22px;
        }
        .titleRow h2 {
          font-size: 18px;
        }

        .sub {
          color: var(--muted);
          margin: 6px 0 0;
          font-size: 13.5px;
          line-height: 1.55;
          font-weight: 650;
          letter-spacing: -0.01em;
        }

        .divider {
          height: 1px;
          background: var(--line);
          margin: 14px 0;
        }

        .kpis {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 12px;
        }

        .kpiBox {
          border: 1px solid var(--line);
          border-radius: var(--radius-sm);
          padding: 12px 12px;
          background: #fff;
        }

        .kpiLabel {
          color: var(--muted);
          font-size: 12px;
          font-weight: 800;
          margin-bottom: 4px;
          letter-spacing: -0.01em;
        }

        .kpiValue {
          font-size: 18px;
          font-weight: 950;
          letter-spacing: -0.03em;
        }

        .formGrid2 {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 12px;
        }

        .field {
          display: grid;
          gap: 6px;
        }

        .field label {
          font-size: 12.5px;
          color: var(--muted);
          font-weight: 850;
          letter-spacing: -0.01em;
        }

        .field input,
        .field select,
        .field textarea {
          border-radius: 12px;
          border: 1px solid var(--line);
          padding: 10px 12px;
          font-size: 13.5px;
          outline: none;
          background: #fff;
          font-weight: 650;
          letter-spacing: -0.01em;
        }

        .field input,
        .field select {
          height: 42px;
          padding: 0 12px;
        }

        .field textarea {
          min-height: 90px;
          resize: vertical;
        }

        .field input::placeholder {
          color: rgba(100, 116, 139, 0.75);
          font-weight: 600;
        }

        .field input:focus,
        .field select:focus,
        .field textarea:focus {
          border-color: rgba(37, 99, 235, 0.38);
          box-shadow: 0 0 0 4px rgba(37, 99, 235, 0.1);
        }

        .hint {
          font-size: 12.5px;
          color: var(--muted);
          line-height: 1.55;
          margin-top: 8px;
          font-weight: 650;
          letter-spacing: -0.01em;
        }

        .notice {
          border-radius: 14px;
          padding: 12px 14px;
          border: 1px solid var(--line);
          font-size: 13.5px;
          font-weight: 850;
          display: flex;
          gap: 10px;
          align-items: center;
          letter-spacing: -0.01em;
        }

        .noticeOk {
          background: rgba(34, 197, 94, 0.08);
          border-color: rgba(34, 197, 94, 0.18);
        }
        .noticeErr {
          background: rgba(239, 68, 68, 0.08);
          border-color: rgba(239, 68, 68, 0.18);
        }

        .tableWrap {
          overflow-x: auto;
          border: 1px solid var(--line);
          border-radius: 14px;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          min-width: 860px; /* ✅ lebih lebar karena ada kolom bobot & peluang */
          background: #fff;
        }
        thead th {
          text-align: left;
          font-size: 12px;
          color: var(--muted);
          padding: 12px;
          border-bottom: 1px solid var(--line);
          background: rgba(15, 23, 42, 0.02);
          white-space: nowrap;
          font-weight: 850;
          letter-spacing: -0.01em;
        }
        tbody td {
          padding: 12px;
          border-bottom: 1px solid var(--line);
          font-size: 13.5px;
          vertical-align: top;
          font-weight: 650;
          letter-spacing: -0.01em;
        }
        tbody tr:hover td {
          background: rgba(37, 99, 235, 0.035);
        }

        .pillGreen {
          background: rgba(34, 197, 94, 0.1);
          color: rgba(22, 163, 74, 1);
          border-color: rgba(34, 197, 94, 0.18);
        }
        .pillRed {
          background: rgba(239, 68, 68, 0.1);
          color: rgba(220, 38, 38, 1);
          border-color: rgba(239, 68, 68, 0.18);
        }
        .pillGray {
          background: rgba(100, 116, 139, 0.1);
          color: rgba(71, 85, 105, 1);
          border-color: rgba(100, 116, 139, 0.18);
        }

        .chanceBar {
          width: 160px;
          height: 10px;
          border-radius: 999px;
          border: 1px solid var(--line);
          background: rgba(15, 23, 42, 0.03);
          overflow: hidden;
        }
        .chanceFill {
          height: 100%;
          background: rgba(37, 99, 235, 0.55);
          width: 0%;
        }

        /* ✅ Row clickable */
        .rowClickable {
          cursor: pointer;
        }

        /* ✅ Modal */
        .modalOverlay {
          position: fixed;
          inset: 0;
          background: rgba(15, 23, 42, 0.45);
          backdrop-filter: blur(6px);
          z-index: 80;
          display: grid;
          place-items: center;
          padding: 18px;
        }
        .modalCard {
          width: min(980px, 100%);
          background: var(--card);
          border: 1px solid var(--line);
          border-radius: 18px;
          box-shadow: 0 24px 80px rgba(15, 23, 42, 0.28);
          overflow: hidden;
        }
        .modalHead {
          padding: 16px 16px;
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 12px;
          border-bottom: 1px solid var(--line);
          background: rgba(15, 23, 42, 0.015);
        }
        .modalHead h3 {
          margin: 0;
          font-size: 16px;
          font-weight: 950;
          letter-spacing: -0.03em;
        }
        .modalHead p {
          margin: 6px 0 0;
          color: var(--muted);
          font-size: 13px;
          line-height: 1.45;
          font-weight: 650;
          letter-spacing: -0.01em;
        }
        .modalBody {
          padding: 16px;
          display: grid;
          gap: 14px;
        }
        .modalGrid {
          display: grid;
          grid-template-columns: 1fr 1fr 1fr;
          gap: 12px;
        }
        .miniBox {
          border: 1px solid var(--line);
          border-radius: 14px;
          padding: 12px;
          background: #fff;
        }
        .miniLabel {
          font-size: 12px;
          color: var(--muted);
          font-weight: 850;
          margin-bottom: 6px;
          letter-spacing: -0.01em;
        }
        .miniValue {
          font-size: 16px;
          font-weight: 950;
          letter-spacing: -0.03em;
        }
        .modalFoot {
          padding: 14px 16px;
          border-top: 1px solid var(--line);
          display: flex;
          justify-content: flex-end;
          gap: 10px;
          background: rgba(15, 23, 42, 0.015);
          flex-wrap: wrap;
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
          .formGrid2 {
            grid-template-columns: 1fr;
          }
          table {
            min-width: 980px;
          }
          .modalGrid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>

      <div className="appShell">
        <header className="appHeader">
          <div className="headerInner">
            <div className="brandRow">
              <div className="logoWrap" aria-hidden="true">
                <Image
                  src={rainbowLogo}
                  alt="SPP Rainbow"
                  width={44}
                  height={44}
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                  priority
                />
              </div>
              <div className="brandText">
                <b>SPP SHINING SUN</b>
                <span>
                  {role === "admin_cabang"
                    ? "Admin Cabang Panel"
                    : "Super Admin Panel"}
                </span>
              </div>
            </div>

            <div className="headerRight">
              {/* ✅ selector cabang (superadmin) / info cabang (admin cabang) */}
              <span className="pill" title="Konteks Cabang aktif">
                🏢 {branchLabel}
              </span>

              {role === "superadmin" ? (
                <select
                  value={activeBranchId || ""}
                  onChange={(e) => setActiveBranchId(e.target.value || null)}
                  style={{
                    height: 40,
                    borderRadius: 12,
                    border: "1px solid var(--line)",
                    padding: "0 10px",
                    fontWeight: 850,
                    letterSpacing: "-0.01em",
                    background: "#fff",
                  }}
                  title="Pilih Cabang untuk dikelola (opsional)"
                >
                  <option value="">(Pilih Cabang)</option>
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name} ({b.code})
                    </option>
                  ))}
                </select>
              ) : null}

              <button className="dangerBtn" onClick={logout}>
                Logout
              </button>
            </div>
          </div>
        </header>

        <div className="layout">
          <aside className="sidebar">
            <div className="sidebarTop">
              <h3>Navigation</h3>
              <span className="pill">
                {role === "admin_cabang" ? "Admin Cabang" : "Super Admin"}
              </span>
            </div>

            <div className="sideMenu">
              {menu.map((m) => {
                const active = m.key === activeSection;
                return (
                  <button
                    key={m.key}
                    className={`menuBtn ${active ? "menuBtnActive" : ""}`}
                    onClick={() => go(m.key)}
                    type="button"
                  >
                    <span>{m.label}</span>
                    <span style={{ opacity: 0.5 }}>›</span>
                  </button>
                );
              })}
            </div>

            {/* ✅ quick tools */}
            <div className="divider" style={{ margin: 0 }} />
            <div className="sideMenu" style={{ paddingTop: 12 }}>
              {role === "superadmin" ? (
                <button
                  className="ghostBtn"
                  type="button"
                  onClick={loadBranches}
                  style={{ justifyContent: "center" }}
                >
                  {loadingBranches ? "Memuat cabang..." : "Refresh Cabang"}
                </button>
              ) : (
                <button
                  className="ghostBtn"
                  type="button"
                  onClick={loadMe}
                  style={{ justifyContent: "center" }}
                >
                  Refresh Session
                </button>
              )}
            </div>
          </aside>

          <main className="content">
            {msg ? (
              <div
                className={`notice ${
                  msg.type === "ok" ? "noticeOk" : "noticeErr"
                }`}
              >
                <span style={{ fontSize: 16 }}>
                  {msg.type === "ok" ? "✅" : "⚠️"}
                </span>
                <span>{msg.text}</span>
              </div>
            ) : null}

            {activeSection === "dashboard" ? (
              <section className="card">
                <div className="titleRow">
                  <div>
                    <h1>
                      Dashboard{" "}
                      {role === "admin_cabang" ? "Admin Cabang" : "Super Admin"}
                    </h1>
                    <p className="sub">
                      {role === "admin_cabang"
                        ? "Kelola siswa cabang & approval pembayaran SPP."
                        : "Panel ringkas untuk mengelola cabang, admin cabang, SPP period aktif, Lucky Spin, dan akun siswa."}
                    </p>
                  </div>
                  <span className="pill">{periodLabel}</span>
                </div>

                <div className="divider" />

                <div className="kpis">
                  <div className="kpiBox">
                    <div className="kpiLabel">Role</div>
                    <div className="kpiValue">
                      {role === "admin_cabang" ? "Admin Cabang" : "Super Admin"}
                    </div>
                  </div>

                  <div className="kpiBox">
                    <div className="kpiLabel">Cabang Aktif</div>
                    <div className="kpiValue">{branchLabel}</div>
                  </div>

                  <div className="kpiBox">
                    <div className="kpiLabel">Sisa Kuota Hadiah</div>
                    <div className="kpiValue">{totalSisa}</div>
                  </div>
                </div>

                <p className="hint" style={{ marginTop: 10 }}>
                  Peluang hadiah ditentukan oleh <b>Bobot (weight)</b>. Semakin
                  besar bobot, semakin sering hadiah itu keluar (selama{" "}
                  <b>sisa kuota &gt; 0</b>).
                </p>
              </section>
            ) : null}

            {/* =========================
             * ✅ SUPERADMIN: LIST CABANG
             * ========================= */}
            {activeSection === "branchList" ? (
              <section className="card">
                <div className="titleRow">
                  <div>
                    <h2>List Cabang</h2>
                    <p className="sub">
                      Kelola cabang sekolah. Pilih cabang di header untuk
                      konteks pengelolaan SPP/Spin/Siswa.
                    </p>
                  </div>
                  <span className="pill">
                    {loadingBranches
                      ? "Memuat..."
                      : `${branches.length} cabang`}
                  </span>
                </div>

                <div className="divider" />

                {branches.length === 0 ? (
                  <p className="hint">
                    Belum ada cabang. Buka menu <b>Tambah Cabang</b>.
                  </p>
                ) : (
                  <div className="tableWrap">
                    <table style={{ minWidth: 920 }}>
                      <thead>
                        <tr>
                          <th>Nama</th>
                          <th>Kode</th>
                          <th>Alamat</th>
                          <th>Status</th>
                          <th>ID</th>
                          <th>Aksi</th>
                        </tr>
                      </thead>
                      <tbody>
                        {branches.map((b) => (
                          <tr key={b.id}>
                            <td>
                              <b>{b.name}</b>
                            </td>
                            <td>
                              <span className="pill">{b.code}</span>
                            </td>
                            <td style={{ color: "var(--muted)" }}>
                              {b.address || "-"}
                            </td>
                            <td>
                              <span
                                className={`pill ${
                                  b.is_active === false
                                    ? "pillRed"
                                    : "pillGreen"
                                }`}
                              >
                                {b.is_active === false ? "Nonaktif" : "Aktif"}
                              </span>
                            </td>
                            <td
                              style={{
                                fontFamily:
                                  "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
                                fontSize: 12.5,
                                color: "var(--muted)",
                              }}
                            >
                              {b.id}
                            </td>
                            <td style={{ display: "flex", gap: 8 }}>
                              <button
                                className="ghostBtn"
                                type="button"
                                onClick={() => {
                                  setActiveBranchId(b.id);
                                  setMsg({
                                    type: "ok",
                                    text: `Cabang aktif: ${b.name} (${b.code})`,
                                  });
                                }}
                                style={{ height: 36, padding: "0 10px" }}
                              >
                                Pilih
                              </button>
                              <button
                                className="dangerBtn"
                                type="button"
                                onClick={() => deleteBranch(b.id)}
                                style={{ height: 36, padding: "0 10px" }}
                              >
                                Hapus
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            ) : null}

            {/* =========================
             * ✅ SUPERADMIN: TAMBAH CABANG
             * ========================= */}
            {activeSection === "branchAdd" ? (
              <section className="card">
                <div className="titleRow">
                  <div>
                    <h2>Tambah Cabang</h2>
                    <p className="sub">
                      Buat cabang baru. Setelah dibuat, kamu bisa buat{" "}
                      <b>Admin Cabang</b> untuk cabang tersebut.
                    </p>
                  </div>
                  <span className="pill">Super Admin</span>
                </div>

                <div className="divider" />

                <div className="formGrid2">
                  <div className="field">
                    <label>Kode Cabang</label>
                    <input
                      value={branchCode}
                      onChange={(e) => setBranchCode(e.target.value)}
                      placeholder="CAB-01"
                    />
                  </div>

                  <div className="field">
                    <label>Nama Cabang</label>
                    <input
                      value={branchName}
                      onChange={(e) => setBranchName(e.target.value)}
                      placeholder="Cabang Tulungagung"
                    />
                  </div>

                  <div className="field" style={{ gridColumn: "1 / -1" }}>
                    <label>Alamat (opsional)</label>
                    <textarea
                      value={branchAddress}
                      onChange={(e) => setBranchAddress(e.target.value)}
                      placeholder="Alamat cabang..."
                    />
                  </div>

                  <div style={{ display: "flex", alignItems: "end" }}>
                    <button
                      className="primaryBtn"
                      onClick={addBranch}
                      type="button"
                    >
                      Buat Cabang
                    </button>
                  </div>
                </div>

                <p className="hint">
                  Setelah cabang dibuat, masuk menu <b>Admin Cabang</b> untuk
                  membuat akun admin cabang.
                </p>
              </section>
            ) : null}

            {/* =========================
             * ✅ SUPERADMIN: ADMIN CABANG
             * ========================= */}
            {activeSection === "branchAdmins" ? (
              <section className="card">
                <div className="titleRow">
                  <div>
                    <h2>Admin Cabang</h2>
                    <p className="sub">
                      Buat & kelola akun admin cabang untuk cabang terpilih.
                    </p>
                  </div>
                  <span className="pill">{branchLabel}</span>
                </div>

                <div className="divider" />

                <div className="formGrid2">
                  <div className="field">
                    <label>Cabang (wajib)</label>
                    <select
                      value={activeBranchId || ""}
                      onChange={(e) =>
                        setActiveBranchId(e.target.value || null)
                      }
                    >
                      <option value="">(Pilih Cabang)</option>
                      {branches.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.name} ({b.code})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="field">
                    <label>Username admin cabang</label>
                    <input
                      value={adminUsername}
                      onChange={(e) => setAdminUsername(e.target.value)}
                      placeholder="admin.cabang"
                    />
                  </div>

                  <div className="field">
                    <label>Nama</label>
                    <input
                      value={adminName}
                      onChange={(e) => setAdminName(e.target.value)}
                      placeholder="Admin Cabang"
                    />
                  </div>

                  <div className="field">
                    <label>Password awal</label>
                    <input
                      value={adminPass}
                      onChange={(e) => setAdminPass(e.target.value)}
                      placeholder="123456"
                    />
                  </div>

                  <div style={{ display: "flex", alignItems: "end" }}>
                    <button
                      className="primaryBtn"
                      onClick={addBranchAdmin}
                      type="button"
                    >
                      Buat Admin Cabang
                    </button>
                  </div>

                  <div style={{ display: "flex", alignItems: "end" }}>
                    <button
                      className="ghostBtn"
                      onClick={loadBranchAdmins}
                      type="button"
                      style={{ justifyContent: "center" }}
                    >
                      {loadingAdmins ? "Memuat..." : "Refresh List Admin"}
                    </button>
                  </div>
                </div>

                <div className="divider" style={{ marginTop: 16 }} />

                {admins.length === 0 ? (
                  <p className="hint">
                    Belum ada admin cabang untuk cabang ini. Buat admin di atas.
                  </p>
                ) : (
                  <div className="tableWrap">
                    <table style={{ minWidth: 920 }}>
                      <thead>
                        <tr>
                          <th>Username</th>
                          <th>Nama</th>
                          <th>Cabang</th>
                          <th>Status</th>
                          <th>ID</th>
                          <th>Aksi</th>
                        </tr>
                      </thead>
                      <tbody>
                        {admins.map((a) => (
                          <tr key={a.id}>
                            <td>
                              <b>{a.username}</b>
                            </td>
                            <td>{a.name || "-"}</td>
                            <td>
                              <span className="pill">
                                {a.branch_name || a.branch_id}
                              </span>
                            </td>
                            <td>
                              <span
                                className={`pill ${
                                  a.is_active === false
                                    ? "pillRed"
                                    : "pillGreen"
                                }`}
                              >
                                {a.is_active === false ? "Nonaktif" : "Aktif"}
                              </span>
                            </td>
                            <td
                              style={{
                                fontFamily:
                                  "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
                                fontSize: 12.5,
                                color: "var(--muted)",
                              }}
                            >
                              {a.id}
                            </td>
                            <td>
                              <button
                                className="dangerBtn"
                                type="button"
                                style={{ height: 36, padding: "0 10px" }}
                                disabled={adminDeletingId === a.id}
                                onClick={() => deleteBranchAdmin(a)}
                              >
                                {adminDeletingId === a.id ? "..." : "Hapus"}
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                <p className="hint">
                  Catatan: akses admin cabang dibatasi hanya ke siswa & approval
                  pembayaran SPP untuk cabangnya.
                </p>
              </section>
            ) : null}

            {/* =========================
             * ✅ ADMIN CABANG: APPROVAL SPP
             * ========================= */}
            {activeSection === "approvalSpp" ? (
              <section className="card">
                <div className="titleRow">
                  <div>
                    <h2>Approval Bayar SPP</h2>
                    <p className="sub">
                      Lihat pembayaran <b>PENDING</b> dan lakukan
                      approve/reject.
                    </p>
                  </div>
                  <span className="pill">
                    {loadingPending
                      ? "Memuat..."
                      : `${pendingPayments.length} pending`}
                  </span>
                </div>

                <div className="divider" />

                <div className="formGrid2">
                  <div className="field">
                    <label>Cari</label>
                    <input
                      value={pendingQ}
                      onChange={(e) => setPendingQ(e.target.value)}
                      placeholder="NIS / Nama / Kelas / Ref"
                    />
                  </div>
                  <div style={{ display: "flex", alignItems: "end", gap: 10 }}>
                    <button
                      className="primaryBtn"
                      type="button"
                      onClick={loadPendingPayments}
                    >
                      Tampilkan
                    </button>
                    <button
                      className="ghostBtn"
                      type="button"
                      onClick={() => {
                        setPendingQ("");
                        loadPendingPayments();
                      }}
                    >
                      Reset
                    </button>
                  </div>
                </div>

                {pendingPayments.length === 0 ? (
                  <p className="hint">
                    Tidak ada pembayaran pending untuk cabang ini.
                  </p>
                ) : (
                  <div className="tableWrap">
                    <table style={{ minWidth: 980 }}>
                      <thead>
                        <tr>
                          <th>Siswa</th>
                          <th>NIS</th>
                          <th>Kelas</th>
                          <th>Periode</th>
                          <th>Nominal</th>
                          <th>Metode</th>
                          <th>Ref</th>
                          <th>Request</th>
                          <th>Status</th>
                          <th>Aksi</th>
                        </tr>
                      </thead>
                      <tbody>
                        {pendingPayments.map((p) => (
                          <tr key={p.id}>
                            <td>
                              <b>{p.student_name || "-"}</b>
                            </td>
                            <td>{p.nis || "-"}</td>
                            <td>
                              <span
                                className="pill"
                                style={{ fontWeight: 900 }}
                              >
                                {p.kelas || "-"}
                              </span>
                            </td>
                            <td>
                              <b>{formatPeriode(p.period)}</b>
                            </td>
                            <td>
                              Rp {Number(p.amount || 0).toLocaleString("id-ID")}
                            </td>
                            <td>{p.method || "-"}</td>
                            <td
                              style={{
                                fontFamily:
                                  "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
                                fontSize: 12.5,
                                color: "var(--muted)",
                              }}
                            >
                              {p.ref || "-"}
                            </td>
                            <td>
                              {p.requested_at
                                ? new Date(p.requested_at).toLocaleString(
                                    "id-ID"
                                  )
                                : "-"}
                            </td>
                            <td>
                              <span className="pill">
                                {String(p.status || "").toUpperCase()}
                              </span>
                            </td>
                            <td style={{ display: "flex", gap: 8 }}>
                              <button
                                className="primaryBtn"
                                type="button"
                                style={{ height: 36, padding: "0 10px" }}
                                disabled={actingPaymentId === p.id}
                                onClick={() => approvePayment(p.id)}
                              >
                                {actingPaymentId === p.id ? "..." : "Approve"}
                              </button>
                              <button
                                className="dangerBtn"
                                type="button"
                                style={{ height: 36, padding: "0 10px" }}
                                disabled={actingPaymentId === p.id}
                                onClick={() => rejectPayment(p.id)}
                              >
                                {actingPaymentId === p.id ? "..." : "Reject"}
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                <p className="hint">
                  Setelah approve, status periode aktif siswa akan berubah
                  menjadi <b>PAID</b> dan tidak muncul di daftar pending.
                </p>
              </section>
            ) : null}

            {/* =========================
             * ✅ EXISTING SECTIONS (tetap)
             * ========================= */}
            {activeSection === "setSpp" ? (
              <section className="card">
                <div className="titleRow">
                  <div>
                    <h2>Set SPP Period Aktif</h2>
                    <p className="sub">
                      Tentukan period, nominal SPP, dan batas Lucky Spin.
                    </p>
                  </div>
                  <span className="pill">Wajib</span>
                </div>

                <div className="divider" />

                <div className="formGrid2">
                  <div className="field">
                    <label>Period (YYYY-MM)</label>
                    <input
                      value={period}
                      onChange={(e) => setPeriod(e.target.value)}
                      placeholder="2025-12"
                    />
                  </div>

                  <div className="field">
                    <label>Nominal SPP</label>
                    <input
                      type="number"
                      value={amount}
                      onChange={(e) => setAmount(Number(e.target.value))}
                    />
                  </div>

                  <div className="field">
                    <label>Batas Lucky Spin (tanggal)</label>
                    <input
                      type="number"
                      value={deadline}
                      onChange={(e) => setDeadline(Number(e.target.value))}
                    />
                  </div>

                  <div style={{ display: "flex", alignItems: "end" }}>
                    <button
                      className="primaryBtn"
                      onClick={setSpp}
                      type="button"
                    >
                      Simpan Pengaturan
                    </button>
                  </div>
                </div>

                <p className="hint">
                  Spin berlaku jika tanggal hari ini &lt; <b>{deadline}</b>.
                </p>
              </section>
            ) : null}

            {activeSection === "addPrize" ? (
              <section className="card">
                <div className="titleRow">
                  <div>
                    <h2>Tambah Hadiah</h2>
                    <p className="sub">
                      Tambahkan hadiah untuk Lucky Spin sesuai period aktif.
                    </p>
                  </div>
                  <span className="pill">Lucky Spin</span>
                </div>

                <div className="divider" />

                <div className="formGrid2">
                  <div className="field">
                    <label>Period</label>
                    <input
                      value={period}
                      onChange={(e) => setPeriod(e.target.value)}
                      placeholder="2025-12"
                    />
                  </div>

                  <div className="field">
                    <label>Label hadiah</label>
                    <input
                      value={label}
                      onChange={(e) => setLabel(e.target.value)}
                      placeholder="Diskon 10rb / Zonk"
                    />
                  </div>

                  <div className="field">
                    <label>Tipe</label>
                    <select
                      value={type}
                      onChange={(e) => setType(e.target.value as any)}
                    >
                      <option value="FIXED">FIXED (rupiah)</option>
                      <option value="PERCENT">PERCENT (%)</option>
                      <option value="NONE">NONE (zonk)</option>
                    </select>
                  </div>

                  <div className="field">
                    <label>Value</label>
                    <input
                      type="number"
                      value={value}
                      onChange={(e) => setValue(Number(e.target.value))}
                    />
                  </div>

                  <div className="field">
                    <label>Kuota</label>
                    <input
                      type="number"
                      value={quota}
                      onChange={(e) => setQuota(Number(e.target.value))}
                    />
                  </div>

                  <div className="field">
                    <label>Bobot peluang (weight)</label>
                    <input
                      type="number"
                      value={weight}
                      onChange={(e) => setWeight(Number(e.target.value))}
                      placeholder="misal 90 (sering), 10 (jarang)"
                    />
                  </div>

                  <div style={{ display: "flex", alignItems: "end" }}>
                    <button
                      className="primaryBtn"
                      onClick={addPrize}
                      type="button"
                    >
                      Tambah Hadiah
                    </button>
                  </div>
                </div>

                <p className="hint">
                  Contoh: hadiah 5rb weight <b>90</b> dan hadiah 10rb weight{" "}
                  <b>10</b> → peluang kira-kira 90% vs 10% (selama sisa kuota
                  masih ada).
                </p>
              </section>
            ) : null}

            {activeSection === "listPrize" ? (
              <section className="card">
                <div className="titleRow">
                  <div>
                    <h2>List Hadiah</h2>
                    <p className="sub">
                      Daftar hadiah periode <b>{periodLabel}</b> beserta bobot &
                      peluang keluar.
                    </p>
                  </div>

                  <div
                    style={{ display: "flex", gap: 10, alignItems: "center" }}
                  >
                    <span className="pill">
                      {loadingList ? "Memuat..." : `${totalHadiah} item`}
                    </span>
                    <button
                      className="dangerBtn"
                      onClick={clearPrizes}
                      type="button"
                      disabled={clearingPrizes || totalHadiah === 0}
                      title="Hapus semua hadiah untuk periode ini"
                    >
                      {clearingPrizes ? "Menghapus..." : "Hapus Semua Hadiah"}
                    </button>
                  </div>
                </div>

                <div className="divider" />

                {totalHadiah === 0 ? (
                  <p className="hint">
                    Belum ada hadiah untuk periode ini. Tambahkan minimal 5
                    hadiah (termasuk zonk).
                  </p>
                ) : (
                  <>
                    <p className="hint" style={{ marginTop: 0 }}>
                      Peluang dihitung dari hadiah yang <b>aktif</b>,{" "}
                      <b>sisa &gt; 0</b>, dan <b>weight &gt; 0</b>. Rumus:
                      peluang = weight / totalWeight × 100.
                    </p>

                    <div className="tableWrap">
                      <table>
                        <thead>
                          <tr>
                            <th>Label</th>
                            <th>Tipe</th>
                            <th>Nilai</th>
                            <th>Kuota</th>
                            <th>Terpakai</th>
                            <th>Sisa</th>
                            <th>Bobot</th>
                            <th>Peluang</th>
                            <th>Aksi</th>
                          </tr>
                        </thead>
                        <tbody>
                          {prizes.map((p) => {
                            const sisa = Math.max(
                              0,
                              Number(p.quota) - Number(p.used)
                            );
                            const w = Number(p.weight ?? 1);
                            const chance = Number(chanceMap[p.id] || 0);

                            return (
                              <tr key={p.id}>
                                <td>
                                  <b>{p.label}</b>
                                </td>
                                <td>
                                  <span
                                    className="pill"
                                    style={{ fontWeight: 900 }}
                                  >
                                    {p.type}
                                  </span>
                                </td>
                                <td>{formatHadiah(p)}</td>
                                <td>{p.quota}</td>
                                <td>{p.used}</td>
                                <td>
                                  <span
                                    className={`pill ${
                                      sisa > 0 ? "pillGreen" : "pillRed"
                                    }`}
                                  >
                                    {sisa}
                                  </span>
                                </td>
                                <td>
                                  <span
                                    className="pill"
                                    style={{ fontWeight: 900 }}
                                  >
                                    {Number.isFinite(w) ? w : 1}
                                  </span>
                                </td>
                                <td>
                                  <div style={{ display: "grid", gap: 6 }}>
                                    <div
                                      style={{
                                        display: "flex",
                                        gap: 10,
                                        alignItems: "center",
                                      }}
                                    >
                                      <div className="chanceBar">
                                        <div
                                          className="chanceFill"
                                          style={{
                                            width: `${Math.max(
                                              0,
                                              Math.min(100, chance)
                                            ).toFixed(2)}%`,
                                          }}
                                        />
                                      </div>
                                      <b style={{ minWidth: 72 }}>
                                        {chance.toFixed(2)}%
                                      </b>
                                    </div>
                                    <span
                                      style={{
                                        fontSize: 12,
                                        color: "var(--muted)",
                                        fontWeight: 650,
                                        letterSpacing: "-0.01em",
                                      }}
                                    >
                                      {p.active && sisa > 0 && (w ?? 1) > 0
                                        ? "Eligible"
                                        : "Tidak ikut undian"}
                                    </span>
                                  </div>
                                </td>
                                <td>
                                  <button
                                    className="dangerBtn"
                                    onClick={() => deletePrize(p.id)}
                                    type="button"
                                    style={{ height: 36, padding: "0 10px" }}
                                  >
                                    Hapus
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}
              </section>
            ) : null}

            {activeSection === "addStudent" ? (
              <section className="card">
                <div className="titleRow">
                  <div>
                    <h2>Tambah Siswa + Buat Akun</h2>
                    <p className="sub">
                      Username siswa otomatis (0001, 0002, 0003, dst).
                    </p>
                  </div>
                  <span className="pill">Siswa</span>
                </div>

                <div className="divider" />

                <div className="formGrid2">
                  <div className="field">
                    <label>NIS / Username (otomatis)</label>
                    <input value={nis} readOnly />
                  </div>

                  <div className="field">
                    <label>Nama</label>
                    <input
                      value={nama}
                      onChange={(e) => setNama(e.target.value)}
                    />
                  </div>

                  <div className="field">
                    <label>Kelas</label>
                    <input
                      value={kelas}
                      onChange={(e) => setKelas(e.target.value)}
                    />
                  </div>

                  <div className="field">
                    <label>Password awal</label>
                    <input
                      value={pass}
                      onChange={(e) => setPass(e.target.value)}
                    />
                  </div>

                  <div style={{ display: "flex", alignItems: "end" }}>
                    <button
                      className="primaryBtn"
                      onClick={addStudent}
                      type="button"
                    >
                      Buat Akun Siswa
                    </button>
                  </div>
                </div>

                <div className="divider" style={{ marginTop: 16 }} />

                <div className="titleRow" style={{ marginBottom: 10 }}>
                  <div>
                    <h2>List Siswa Terbaru</h2>
                    <p className="sub">
                      Setelah tambah, siswa akan muncul di sini dan bisa login
                      pakai username (NIS) + password.
                    </p>
                  </div>

                  <button
                    className="primaryBtn"
                    type="button"
                    onClick={loadStudents}
                  >
                    {loadingStudents ? "Memuat..." : "Refresh"}
                  </button>
                </div>

                {students.length === 0 ? (
                  <p className="hint">Belum ada data siswa. Klik Refresh.</p>
                ) : (
                  <div className="tableWrap">
                    <table style={{ minWidth: 820 }}>
                      <thead>
                        <tr>
                          <th>NIS</th>
                          <th>Nama</th>
                          <th>Kelas</th>
                          <th>Username</th>
                          <th>Aksi</th>
                        </tr>
                      </thead>
                      <tbody>
                        {students.slice(0, 20).map((s, idx) => (
                          <tr key={(s.id || s.nis) + "-" + idx}>
                            <td>
                              <b>{s.nis}</b>
                            </td>
                            <td>{s.nama}</td>
                            <td>
                              <span
                                className="pill"
                                style={{ fontWeight: 900 }}
                              >
                                {s.kelas}
                              </span>
                            </td>
                            <td>{s.username || s.nis}</td>
                            <td>
                              <button
                                className="dangerBtn"
                                type="button"
                                style={{ height: 34, padding: "0 10px" }}
                                disabled={
                                  deletingStudentId === String(s.id || s.nis)
                                }
                                onClick={() => deleteStudent(s)}
                              >
                                {deletingStudentId === String(s.id || s.nis)
                                  ? "..."
                                  : "Hapus"}
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            ) : null}

            {activeSection === "listStudent" ? (
              <section className="card">
                <div className="titleRow">
                  <div>
                    <h2>List Siswa</h2>
                    <p className="sub">
                      Klik salah satu siswa untuk melihat <b>status bayar</b>{" "}
                      dan <b>riwayat pembayaran</b>.
                    </p>
                  </div>
                  <span className="pill">
                    {loadingStudents ? "Memuat..." : `${students.length} siswa`}
                  </span>
                </div>

                <div className="divider" />

                <div className="formGrid2">
                  <div className="field">
                    <label>Cari</label>
                    <input
                      value={studentQ}
                      onChange={(e) => setStudentQ(e.target.value)}
                      placeholder="contoh: 0001 / Budi / X-A"
                    />
                  </div>
                  <div style={{ display: "flex", alignItems: "end" }}>
                    <button
                      className="primaryBtn"
                      onClick={loadStudents}
                      type="button"
                    >
                      Tampilkan
                    </button>
                  </div>
                </div>

                {students.length === 0 ? (
                  <p className="hint">
                    Belum ada data siswa atau hasil pencarian kosong. Klik{" "}
                    <b>Tampilkan</b>.
                  </p>
                ) : (
                  <div className="tableWrap">
                    <table style={{ minWidth: 980 }}>
                      <thead>
                        <tr>
                          <th>NIS</th>
                          <th>Nama</th>
                          <th>Kelas</th>
                          <th>Username</th>
                          <th>ID</th>
                          <th>Aksi</th>
                        </tr>
                      </thead>
                      <tbody>
                        {students.map((s, idx) => (
                          <tr
                            key={(s.id || s.nis) + "-" + idx}
                            className="rowClickable"
                            onClick={() => openStudentPayments(s)}
                            title="Klik untuk lihat status bayar & riwayat"
                          >
                            <td>
                              <b>{s.nis}</b>
                            </td>
                            <td>{s.nama}</td>
                            <td>
                              <span
                                className="pill"
                                style={{ fontWeight: 900 }}
                              >
                                {s.kelas}
                              </span>
                            </td>
                            <td>{s.username || s.nis}</td>
                            <td
                              style={{ color: "var(--muted)", fontSize: 12.5 }}
                            >
                              {s.id || "-"}
                            </td>
                            <td>
                              <button
                                className="dangerBtn"
                                type="button"
                                style={{ height: 34, padding: "0 10px" }}
                                disabled={
                                  deletingStudentId === String(s.id || s.nis)
                                }
                                onClick={(e) => {
                                  e.stopPropagation(); // ✅ biar gak kebuka modal
                                  deleteStudent(s);
                                }}
                              >
                                {deletingStudentId === String(s.id || s.nis)
                                  ? "..."
                                  : "Hapus"}
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            ) : null}
          </main>
        </div>
      </div>

      {/* ✅ MODAL DETAIL PEMBAYARAN SISWA */}
      {detailOpen ? (
        <div
          className="modalOverlay"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) closeDetail();
          }}
        >
          <div className="modalCard">
            <div className="modalHead">
              <div>
                <h3>Detail Pembayaran Siswa</h3>
                <p>
                  <b>{selectedStudent?.nama}</b> • NIS{" "}
                  <b>{selectedStudent?.nis}</b> • Kelas{" "}
                  <b>{selectedStudent?.kelas}</b>
                </p>
              </div>
              <button className="dangerBtn" onClick={closeDetail} type="button">
                Tutup
              </button>
            </div>

            <div className="modalBody">
              {detailLoading ? (
                <div className="hint">Memuat detail pembayaran…</div>
              ) : detailErr ? (
                <div className="notice noticeErr">
                  <span style={{ fontSize: 16 }}>⚠️</span>
                  <span>{detailErr}</span>
                </div>
              ) : !studentPayDetail ? (
                <div className="hint">
                  Belum ada data detail. Pastikan endpoint{" "}
                  <b>/api/admin/students/payments</b> tersedia.
                </div>
              ) : (
                <>
                  {/* STATUS PERIODE AKTIF */}
                  <div
                    className="card"
                    style={{ boxShadow: "none", padding: 14 }}
                  >
                    <div className="titleRow" style={{ marginBottom: 6 }}>
                      <div>
                        <h2 style={{ fontSize: 16, margin: 0 }}>
                          Status Periode Aktif
                        </h2>
                        <p className="sub" style={{ marginTop: 6 }}>
                          Periode: <b>{formatPeriode(currentPeriod)}</b>
                        </p>
                      </div>
                      <span
                        className={`pill ${
                          currentStatus === "PAID"
                            ? "pillGreen"
                            : currentStatus === "PENDING"
                            ? "pillGray"
                            : "pillRed"
                        }`}
                        style={{ fontWeight: 950 }}
                      >
                        {currentStatus || "UNKNOWN"}
                      </span>
                    </div>

                    <div className="modalGrid">
                      <div className="miniBox">
                        <div className="miniLabel">SPP</div>
                        <div className="miniValue">
                          {Number.isFinite(currentBase)
                            ? `Rp ${currentBase.toLocaleString("id-ID")}`
                            : "-"}
                        </div>
                      </div>
                      <div className="miniBox">
                        <div className="miniLabel">Diskon</div>
                        <div className="miniValue">
                          {Number.isFinite(currentDisc)
                            ? `Rp ${currentDisc.toLocaleString("id-ID")}`
                            : "-"}
                        </div>
                      </div>
                      <div className="miniBox">
                        <div className="miniLabel">Total Bayar</div>
                        <div className="miniValue">
                          {Number.isFinite(currentFinal)
                            ? `Rp ${currentFinal.toLocaleString("id-ID")}`
                            : "-"}
                        </div>
                      </div>
                    </div>

                    <div className="divider" style={{ margin: "12px 0" }} />

                    <div className="hint" style={{ marginTop: 0 }}>
                      Tanggal bayar:{" "}
                      <b>
                        {studentPayDetail.current?.paid_at
                          ? new Date(
                              studentPayDetail.current.paid_at
                            ).toLocaleString("id-ID")
                          : "-"}
                      </b>{" "}
                      • Metode: <b>{studentPayDetail.current?.method || "-"}</b>{" "}
                      • Ref:{" "}
                      <b
                        style={{
                          fontFamily:
                            "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
                        }}
                      >
                        {studentPayDetail.current?.ref || "-"}
                      </b>
                    </div>
                  </div>

                  {/* RIWAYAT */}
                  <div
                    className="card"
                    style={{ boxShadow: "none", padding: 14 }}
                  >
                    <div className="titleRow" style={{ marginBottom: 6 }}>
                      <div>
                        <h2 style={{ fontSize: 16, margin: 0 }}>
                          Riwayat Pembayaran
                        </h2>
                        <p className="sub" style={{ marginTop: 6 }}>
                          Menampilkan semua transaksi pembayaran (urut terbaru).
                        </p>
                      </div>
                      <span className="pill">
                        {(studentPayDetail.history || []).length} item
                      </span>
                    </div>

                    {(studentPayDetail.history || []).length === 0 ? (
                      <div className="hint">
                        Belum ada riwayat pembayaran untuk siswa ini.
                      </div>
                    ) : (
                      <div className="tableWrap">
                        <table style={{ minWidth: 820 }}>
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
                            {(studentPayDetail.history || []).map((r) => {
                              const st = String(r.status || "").toUpperCase();
                              const isPaid = st === "PAID";
                              return (
                                <tr key={r.id}>
                                  <td>
                                    <b>{formatPeriode(r.period)}</b>
                                  </td>
                                  <td>
                                    Rp{" "}
                                    {Number(r.amount || 0).toLocaleString(
                                      "id-ID"
                                    )}
                                  </td>
                                  <td>
                                    <span
                                      className={`pill ${
                                        isPaid ? "pillGreen" : "pillRed"
                                      }`}
                                      style={{ fontWeight: 950 }}
                                    >
                                      {st || "-"}
                                    </span>
                                  </td>
                                  <td>
                                    {r.paid_at
                                      ? new Date(r.paid_at).toLocaleString(
                                          "id-ID"
                                        )
                                      : "-"}
                                  </td>
                                  <td>{r.method || "-"}</td>
                                  <td
                                    style={{
                                      fontFamily:
                                        "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
                                      fontSize: 12.5,
                                      color: "var(--muted)",
                                    }}
                                  >
                                    {r.ref || "-"}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>

            <div className="modalFoot">
              <button
                className="primaryBtn"
                onClick={closeDetail}
                type="button"
              >
                Selesai
              </button>

              {/* ✅ tombol hapus siswa dari modal */}
              {selectedStudent ? (
                <button
                  className="dangerBtn"
                  onClick={() => deleteStudent(selectedStudent)}
                  type="button"
                  disabled={
                    deletingStudentId ===
                    String(selectedStudent.id || selectedStudent.nis)
                  }
                >
                  {deletingStudentId ===
                  String(selectedStudent.id || selectedStudent.nis)
                    ? "Menghapus..."
                    : "Hapus Siswa"}
                </button>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
