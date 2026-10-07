const express = require("express");
const fs = require("fs");
const path = require("path");
const { createTask, completeTask, countOpen, sanitise } = require("./tasks");

const app = express();
const PORT = process.env.PORT || 3000;

// Configuration comes from a ConfigMap, secrets from a Secret.
const APP_NAME = process.env.APP_NAME || "Taskboard";
const APP_ENV = process.env.APP_ENV || "local";
const DATA_DIR = process.env.DATA_DIR || "/data";
const API_KEY = process.env.API_KEY || "not-set";

const DATA_FILE = path.join(DATA_DIR, "tasks.json");

function load() {
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
  } catch {
    return [];
  }
}

function save(tasks) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(DATA_FILE, JSON.stringify(tasks, null, 2));
}

app.get("/", (req, res) => {
  const tasks = load();
  const rows = tasks
    .map((t) => `<li>${t.done ? "[done] " : "[open] "}${sanitise(t.title)}</li>`)
    .join("");
  res.send(`
    <html>
      <head><title>${APP_NAME}</title></head>
      <body style="font-family: sans-serif; max-width: 600px; margin: 60px auto;">
        <h1>${APP_NAME}</h1>
        <p>Environment: ${APP_ENV}</p>
        <p>${countOpen(tasks)} open of ${tasks.length} total</p>
        <ul>${rows || "<li>no tasks yet</li>"}</ul>
        <p style="color:#666">Prateek Singh, 24BCS10135</p>
      </body>
    </html>
  `);
});

app.post("/tasks/:title", (req, res) => {
  try {
    const tasks = load();
    tasks.push(createTask(req.params.title));
    save(tasks);
    res.status(201).json({ created: true, open: countOpen(tasks) });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post("/tasks/:index/done", (req, res) => {
  const tasks = load();
  const i = Number(req.params.index);
  if (!tasks[i]) return res.status(404).json({ error: "no such task" });
  tasks[i] = completeTask(tasks[i]);
  save(tasks);
  res.json({ done: true, open: countOpen(tasks) });
});

// liveness: is the process alive at all
app.get("/health", (req, res) => res.json({ status: "ok" }));

// readiness: can it actually do its job, which here means write to storage
app.get("/ready", (req, res) => {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.accessSync(DATA_DIR, fs.constants.W_OK);
    res.json({ status: "ready", storage: DATA_DIR });
  } catch (err) {
    res.status(503).json({ status: "not ready", error: err.message });
  }
});

app.get("/metrics", (req, res) => {
  const tasks = load();
  res.type("text/plain").send(
    `# HELP taskboard_tasks_total Number of tasks\n` +
    `# TYPE taskboard_tasks_total gauge\n` +
    `taskboard_tasks_total ${tasks.length}\n` +
    `# HELP taskboard_tasks_open Number of tasks not done\n` +
    `# TYPE taskboard_tasks_open gauge\n` +
    `taskboard_tasks_open ${countOpen(tasks)}\n`
  );
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`${APP_NAME} listening on ${PORT} in ${APP_ENV}, data in ${DATA_DIR}`);
  console.log(`API key is ${API_KEY === "not-set" ? "NOT set" : "set"}`);
});
