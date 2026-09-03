const express = require("express");

const app = express();
const PORT = 3000;

app.get("/", (req, res) => {
  res.send(`
    <html>
      <head><title>Node.js Hello World</title></head>
      <body style="font-family: sans-serif; text-align: center; margin-top: 80px;">
        <h1>Hello World from Node.js running in Docker</h1>
        <p>Prateek Singh, 24BCS10135</p>
      </body>
    </html>
  `);
});

// 0.0.0.0 so the app listens on all interfaces and the port mapping can reach it
app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`);
});
