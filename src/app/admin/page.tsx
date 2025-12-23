"use client";

import { useState } from "react";

export default function AdminPage() {
  const [period, setPeriod] = useState("2025-12");
  const [amount, setAmount] = useState(150000);
  const [deadline, setDeadline] = useState(11);

  const [label, setLabel] = useState("Diskon 10rb");
  const [type, setType] = useState<"FIXED" | "PERCENT" | "NONE">("FIXED");
  const [value, setValue] = useState(10000);
  const [quota, setQuota] = useState(50);

  const [nis, setNis] = useState("123456");
  const [nama, setNama] = useState("Nama Siswa");
  const [kelas, setKelas] = useState("X-A");
  const [pass, setPass] = useState("123456");

  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(
    null
  );

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    location.href = "/login";
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
      text: `SPP aktif: ${d.period.period} • Rp ${Number(
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
    setMsg({
      type: "ok",
      text: `Hadiah ditambah: ${d.prize.label} • quota ${d.prize.quota}`,
    });
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

  return (
    <>
      {/* TOPBAR */}
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
            Kelola SPP period aktif, hadiah Lucky Spin, dan akun siswa.
          </p>

          <div className="hr" />

          <div className="kpis">
            <div className="kpi">
              <div className="label">SPP Period</div>
              <div className="value">{period}</div>
            </div>
            <div className="kpi">
              <div className="label">Nominal</div>
              <div className="value">
                Rp {Number(amount).toLocaleString("id-ID")}
              </div>
            </div>
            <div className="kpi">
              <div className="label">Batas Spin</div>
              <div className="value">Sebelum tgl {deadline}</div>
            </div>
          </div>

          {msg ? (
            <div
              className={
                msg.type === "ok" ? "notice noticeOk" : "notice noticeErr"
              }
            >
              {msg.type === "ok" ? "✅" : "⚠️"} {msg.text}
            </div>
          ) : null}
        </div>

        <div style={{ height: 14 }} />

        <div className="grid2">
          {/* SET PERIOD */}
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

          {/* ADD PRIZE */}
          <section className="card">
            <div className="sectionTitle">
              <h2>Tambah Hadiah Lucky Spin</h2>
              <span className="badge">Diskon</span>
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
                Tambah Hadiah
              </button>
              <div className="small">
                Saran: buat beberapa hadiah + zonk agar random.
              </div>
            </div>
          </section>
        </div>

        <div style={{ height: 14 }} />

        {/* ADD STUDENT */}
        <section className="card">
          <div className="sectionTitle">
            <h2>Tambah Siswa + Buat Akun</h2>
            <span className="badge">Username = NIS</span>
          </div>

          <div className="grid2">
            <div className="form">
              <div className="field">
                <label>NIS</label>
                <input
                  value={nis}
                  onChange={(e) => setNis(e.target.value)}
                  placeholder="123456"
                />
              </div>
              <div className="field">
                <label>Nama</label>
                <input
                  value={nama}
                  onChange={(e) => setNama(e.target.value)}
                  placeholder="Nama Siswa"
                />
              </div>
              <div className="field">
                <label>Kelas</label>
                <input
                  value={kelas}
                  onChange={(e) => setKelas(e.target.value)}
                  placeholder="X-A"
                />
              </div>
            </div>

            <div className="form">
              <div className="field">
                <label>Password awal</label>
                <input
                  value={pass}
                  onChange={(e) => setPass(e.target.value)}
                  placeholder="123456"
                />
              </div>
              <button className="btn btnPrimary" onClick={addStudent}>
                Buat Akun Siswa
              </button>
              <div className="small">
                Setelah dibuat, siswa login di halaman /login.
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
