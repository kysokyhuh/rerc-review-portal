/**
 * Jest setup: runs before all tests
 * Handles DB cleanup, timezone setup, and other globals
 */

// Set timezone for consistent date testing
process.env.TZ = "UTC";

// Set test database URL (must exist before running tests)
if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = "postgresql://jasperadrada@localhost:5432/rerc_test?schema=public";
}

// Suppress console logs during tests (optional)
if (process.env.SUPPRESS_LOGS === "true") {
  global.console = {
    ...console,
    log: jest.fn(),
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
  };
}

// Set test environment variables
process.env.DATABASE_URL =
  process.env.DATABASE_URL ||
  "postgresql://postgres:test@localhost:5432/rerc_test";
process.env.NODE_ENV = "test";
