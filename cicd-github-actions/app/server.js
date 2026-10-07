const express = require("express");
const { greet } = require("./app");

const app = express();
const PORT = process.env.PORT || 3000;

app.get("/", (req, res) => {
  res.send(`
    <html>
      <head><title>CI/CD Demo</title></head>
      <body style="font-family: sans-serif; text-align: center; margin-top: 80px;">
        <h1>${greet("DevOps 2028")}</h1>
        <p>Deployed by a GitHub Actions pipeline</p>
        <p>Prateek Singh, 24BCS10135</p>
      </body>
    </html>
  `);
});

// A health endpoint, which is what a Kubernetes probe would call.
app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`);
});
