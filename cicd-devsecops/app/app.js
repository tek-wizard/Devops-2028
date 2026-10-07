function sanitise(input) {
  if (typeof input !== "string") {
    return "";
  }
  // strip the characters that would let someone inject HTML
  return input.replace(/[<>&"']/g, "");
}

function buildGreeting(name) {
  const clean = sanitise(name);
  return clean === "" ? "Hello, guest" : `Hello, ${clean}`;
}

module.exports = { sanitise, buildGreeting };
