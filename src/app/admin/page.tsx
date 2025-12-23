"use client";

import { useEffect, useMemo, useState } from "react";

type Prize = {
  id: string;
  label: string;
  type: "FIXED" | "PERCENT" | "NONE";
  value: number;
  quota: number;
  used: number;
  active: boolean;
  created_at?: string;
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

export default function AdminPage() {
  const [period, setPeriod] = useState("2025-12");
  const [amount, setAmount] = useState(200000);
  const [deadline, setDeadline] = useState(11);

  // tambah hadiah
  const [label, setLabel] = useState("Diskon 10rb");
  const [type, setType] = useState<"FIXED" | "PERCENT" | "NONE">("FIXED");
  const [value, setValue] = useState(10000);
  const [quota, setQuota] = useState(50);

  // list hadiah
  const [prizes, setPrizes] = useState<Prize[]>([]);
  const [loadingList, setLoadingList] = useState(false);

  // tambah siswa
  const [nis, setNis] = useState("123456");
  const [nama, setNama] = useState("Nama Siswa");
  const [kelas, setKelas] = useState("X-A");
  const [pass, setPass] = useState("123456");

  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(
    null
  );

  const periodLabel = useMemo(() => formatPeriode(period), [period]);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    location.href = "/login";
  }

  async function loadPrizes() {
    setLoadingList(true);
    const res = await fetch(
      `/api/admin/spin-prizes/list?period=${encodeURIComponent(period)}`
    );
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
    const res = await fetch("/api/admin/spp/set", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ period, amount, spin_deadline_day: deadline }),
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

    const res = await fetch("/api/admin/spin-prizes/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ period, label, type, value, quota }),
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
    const res = await fetch(
      `/api/admin/spin-prizes/delete?id=${encodeURIComponent(id)}`,
      {
        method: "DELETE",
      }
    );
    const d = await res.json().catch(() => ({}));
    if (!res.ok)
      return setMsg({ type: "err", text: d?.error || "Gagal hapus hadiah" });

    setMsg({ type: "ok", text: "Hadiah berhasil dihapus" });
    await loadPrizes();
  }

  async function addStudent() {
    setMsg(null);
    const res = await fetch("/api/admin/students/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nis, nama, kelas, password: pass }),
    });
    const d = await res.json().catch(() => ({}));
    if (!res.ok)
      return setMsg({ type: "err", text: d?.error || "Gagal tambah siswa" });
    setMsg({
      type: "ok",
      text: `Akun siswa dibuat: ${d.username} / ${d.password}`,
    });
  }

  // reload list saat period berubah
  useEffect(() => {
    loadPrizes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period]);

  const totalHadiah = prizes.length;
  const totalSisa = prizes.reduce(
    (acc, p) => acc + Math.max(0, Number(p.quota) - Number(p.used)),
    0
  );

  return (
    <>
      <div className="topbar">
        <div className="topbarInner">
          <div className="brand">
            <div className="logo" />
            <div className="brandTitle">
              <b>SPP Rainbow</b>
              <span>Super Admin</span>
            </div>
          </div>
          <div className="actions">
            <a className="btn" href="/login">
              Login
            </a>
            <button className="btn btnDanger" onClick={logout}>
              Logout
            </button>
          </div>
        </div>
      </div>

      <div className="container">
        <div className="card">
          <h1 className="h1">Dashboard Super Admin</h1>
          <p className="p">
            Kelola SPP period aktif dan Lucky Spin (tambah & hapus hadiah).
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

          <div className="kpis">
            <div className="kpi">
              <div className="label">Period</div>
              <div className="value">{periodLabel}</div>
            </div>
            <div className="kpi">
              <div className="label">Total Hadiah</div>
              <div className="value">{totalHadiah}</div>
            </div>
            <div className="kpi">
              <div className="label">Sisa Kuota</div>
              <div className="value">{totalSisa}</div>
            </div>
          </div>
        </div>

        <div style={{ height: 14 }} />

        <div className="grid2">
          <section className="card">
            <div className="sectionTitle">
              <h2>Set SPP Period Aktif</h2>
              <span className="badge">Wajib</span>
            </div>

            <div className="form">
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
              <button className="btn btnPrimary" onClick={setSpp}>
                Simpan
              </button>
              <div className="small">
                Spin berlaku jika tanggal hari ini &lt; {deadline}.
              </div>
            </div>
          </section>

          <section className="card">
            <div className="sectionTitle">
              <h2>Tambah Hadiah</h2>
              <span className="badge">Lucky Spin</span>
            </div>

            <div className="form">
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

              <div className="grid2">
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
              </div>

              <button className="btn btnPrimary" onClick={addPrize}>
                Tambah
              </button>
              <div className="small">
                Setelah tambah, hadiah otomatis muncul di list bawah.
              </div>
            </div>
          </section>
        </div>

        <div style={{ height: 14 }} />

        <section className="card">
          <div className="sectionTitle">
            <h2>List Hadiah ({periodLabel})</h2>
            <span className="badge">
              {loadingList ? "Memuat..." : `${totalHadiah} item`}
            </span>
          </div>

          {totalHadiah === 0 ? (
            <div className="small">
              Belum ada hadiah untuk periode ini. Tambahkan minimal 5 hadiah
              (termasuk zonk).
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table className="table">
                <thead>
                  <tr>
                    <th>Label</th>
                    <th>Tipe</th>
                    <th>Nilai</th>
                    <th>Kuota</th>
                    <th>Terpakai</th>
                    <th>Sisa</th>
                    <th>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {prizes.map((p) => {
                    const sisa = Math.max(0, Number(p.quota) - Number(p.used));
                    return (
                      <tr key={p.id}>
                        <td>
                          <b>{p.label}</b>
                        </td>
                        <td>
                          <span className="pill">{p.type}</span>
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
                          <button
                            className="btn btnDanger btnSm"
                            onClick={() => deletePrize(p.id)}
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
          )}

          <div className="small" style={{ marginTop: 10 }}>
            Catatan: kalau hadiah sudah terpakai (used &gt; 0), menghapus masih
            boleh, tapi efeknya hadiah itu tidak akan keluar lagi.
          </div>
        </section>

        <div style={{ height: 14 }} />

        <section className="card">
          <div className="sectionTitle">
            <h2>Tambah Siswa + Buat Akun</h2>
            <span className="badge">Username = NIS</span>
          </div>

          <div className="grid2">
            <div className="form">
              <div className="field">
                <label>NIS</label>
                <input value={nis} onChange={(e) => setNis(e.target.value)} />
              </div>
              <div className="field">
                <label>Nama</label>
                <input value={nama} onChange={(e) => setNama(e.target.value)} />
              </div>
              <div className="field">
                <label>Kelas</label>
                <input
                  value={kelas}
                  onChange={(e) => setKelas(e.target.value)}
                />
              </div>
            </div>

            <div className="form">
              <div className="field">
                <label>Password awal</label>
                <input value={pass} onChange={(e) => setPass(e.target.value)} />
              </div>
              <button className="btn btnPrimary" onClick={addStudent}>
                Buat Akun Siswa
              </button>
              <div className="small">
                Siswa login di /login menggunakan NIS dan password ini.
              </div>
            </div>
          </div>
        </section>

        <div style={{ height: 18 }} />
        <div className="small">© {new Date().getFullYear()} SPP Rainbow</div>
      </div>
    </>
  );
}
