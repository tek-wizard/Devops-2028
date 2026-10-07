// The task logic, kept separate from the server so it can be tested on its own.

function sanitise(text) {
  if (typeof text !== "string") return "";
  return text.replace(/[<>&"']/g, "").trim();
}

function createTask(title) {
  const clean = sanitise(title);
  if (clean === "") {
    throw new Error("a task needs a title");
  }
  return { title: clean, done: false, created: new Date().toISOString() };
}

function completeTask(task) {
  return { ...task, done: true };
}

function countOpen(tasks) {
  if (!Array.isArray(tasks)) return 0;
  return tasks.filter((t) => !t.done).length;
}

module.exports = { sanitise, createTask, completeTask, countOpen };
