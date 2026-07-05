// Jest setup: force test environment BEFORE any app module (and thus config) loads.
// This silences logging and disables auth warnings during tests.
process.env.NODE_ENV = 'test';
process.env.METRICS_ENABLED = process.env.METRICS_ENABLED || 'true';
