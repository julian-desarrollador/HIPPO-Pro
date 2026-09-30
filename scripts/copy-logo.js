const fs = require("fs");

fs.mkdirSync("public", { recursive: true });
fs.copyFileSync("assets/images/logo.jpeg", "public/logo.jpeg");
