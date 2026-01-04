const { hashPassword } = require("./src/lib/hash");

(async () => {
  const pass = process.argv[2] || "admin123";
  const h = await hashPassword(pass);
  console.log(h);
})();
