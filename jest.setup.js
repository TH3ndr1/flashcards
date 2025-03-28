// jest.setup.js
const ReactDOM = require('react-dom/client');
require('@testing-library/jest-dom');

// Polyfill for crypto.randomUUID if it's not available
if (typeof crypto === 'undefined') {
  global.crypto = require('crypto');
}
if (!crypto.randomUUID) {
  const { v4: uuidv4 } = require('uuid');
  crypto.randomUUID = uuidv4;
}
const originalConsoleError = console.error;
console.error = (...args) => {
  const [firstArg] = args;
  if (
    typeof firstArg === 'string' &&
    firstArg.includes('The current testing environment is not configured to support act')
  ) {
    return;
  }
  originalConsoleError(...args);
};