const test = require("node:test");
const assert = require("node:assert");
const { sanitise, createTask, completeTask, countOpen } = require("./tasks");

test("sanitise removes characters used for HTML injection", () => {
  assert.strictEqual(sanitise("<script>x</script>"), "scriptx/script");
});

test("sanitise handles values that are not strings", () => {
  assert.strictEqual(sanitise(null), "");
  assert.strictEqual(sanitise(7), "");
});

test("createTask builds a task that starts not done", () => {
  const t = createTask("write the report");
  assert.strictEqual(t.title, "write the report");
  assert.strictEqual(t.done, false);
});

test("createTask refuses an empty title", () => {
  assert.throws(() => createTask("   "), /a task needs a title/);
});

test("completeTask marks it done without changing the original", () => {
  const t = createTask("deploy");
  const done = completeTask(t);
  assert.strictEqual(done.done, true);
  assert.strictEqual(t.done, false);
});

test("countOpen counts only the ones not done", () => {
  const tasks = [{ done: false }, { done: true }, { done: false }];
  assert.strictEqual(countOpen(tasks), 2);
  assert.strictEqual(countOpen("not an array"), 0);
});
