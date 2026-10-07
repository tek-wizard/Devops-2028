const test = require("node:test");
const assert = require("node:assert");
const { greet, add } = require("./app");

test("greet uses the name it is given", () => {
  assert.strictEqual(greet("Prateek"), "Hello, Prateek");
});

test("greet falls back when the name is empty", () => {
  assert.strictEqual(greet(""), "Hello, world");
  assert.strictEqual(greet("   "), "Hello, world");
  assert.strictEqual(greet(undefined), "Hello, world");
});

test("greet trims surrounding spaces", () => {
  assert.strictEqual(greet("  Prateek  "), "Hello, Prateek");
});

test("add sums two numbers", () => {
  assert.strictEqual(add(2, 3), 5);
  assert.strictEqual(add(-1, 1), 0);
});

test("add rejects anything that is not a number", () => {
  assert.throws(() => add("2", 3), TypeError);
});
