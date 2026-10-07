// The logic is kept separate from the server so the tests can import it
// without starting a listener.
function greet(name) {
  if (!name || name.trim() === "") {
    return "Hello, world";
  }
  return `Hello, ${name.trim()}`;
}

function add(a, b) {
  if (typeof a !== "number" || typeof b !== "number") {
    throw new TypeError("both arguments must be numbers");
  }
  return a + b;
}

module.exports = { greet, add };
