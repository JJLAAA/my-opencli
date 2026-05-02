#!/usr/bin/env bun
import { runCli } from '../src/cli.js';

try {
  await runCli();
} catch (error) {
  console.error(JSON.stringify({
    error: {
      code: 'internal_error',
      message: error.message,
      suggestion: null,
      retryable: false,
      details: {},
    },
  }, null, 2));
  process.exit(1);
}
