const test = require("node:test");
const assert = require("node:assert");
const { sanitise, buildGreeting } = require("./app");

test("sanitise strips characters used for HTML injection", () => {
  assert.strictEqual(sanitise("<script>alert(1)</script>"), "scriptalert(1)/script");
});

test("sanitise handles non strings", () => {
  assert.strictEqual(sanitise(null), "");
  assert.strictEqual(sanitise(42), "");
});

test("buildGreeting falls back when there is no name", () => {
  assert.strictEqual(buildGreeting(""), "Hello, guest");
});

test("buildGreeting uses a clean name", () => {
  assert.strictEqual(buildGreeting("Prateek"), "Hello, Prateek");
});
