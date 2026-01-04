import { supabaseAdmin } from "../src/lib/supabaseAdmin";
import { hashPassword } from "../src/lib/hash";

async function main() {
  const username = "admin"; // ganti jika mau
  const password = "admin123"; // ganti jika mau (min 6)

  const password_hash = await hashPassword(password);

  // biar aman, hapus jika username sudah ada
  await supabaseAdmin.from("users_app").delete().eq("username", username);

  const { data, error } = await supabaseAdmin
    .from("users_app")
    .insert([
      {
        username,
        password_hash,
        role: "SUPER_ADMIN",
        is_active: true,
        student_id: null,
      },
    ])
    .select("id, username, role, is_active, created_at")
    .single();

  if (error) {
    console.error("Gagal bikin SUPER_ADMIN:", error.message);
    process.exit(1);
  }

  console.log("✅ SUPER_ADMIN dibuat:", data);
  console.log("🔐 Login pakai:");
  console.log("username:", username);
  console.log("password:", password);
}

main();
