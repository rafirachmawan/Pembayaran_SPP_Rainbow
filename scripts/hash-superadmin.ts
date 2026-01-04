import { hashPassword } from "../src/lib/hash";

async function main() {
  const pass = process.argv[2] || "admin123";
  const h = await hashPassword(pass);
  console.log(h);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
