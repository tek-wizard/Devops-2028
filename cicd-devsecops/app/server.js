const express = require("express");
const { buildGreeting } = require("./app");

const app = express();
const PORT = process.env.PORT || 3000;

// Secrets come from the environment, never from the source.
const API_KEY = process.env.API_KEY || "not-set";

app.get("/", (req, res) => {
  const name = req.query.name || "";
  res.send(`
    <html>
      <head><title>DevSecOps Demo</title></head>
      <body style="font-family: sans-serif; text-align: center; margin-top: 80px;">
        <h1>${buildGreeting(name)}</h1>
        <p>Built by a pipeline with security scanning</p>
        <p>Prateek Singh, 24BCS10135</p>
      </body>
    </html>
  `);
});

app.get("/health", (req, res) => res.json({ status: "ok" }));

app.listen(PORT, "0.0.0.0", () => console.log(`Server running on port ${PORT}`));
