#!/usr/bin/env bun
import { isJsonMode, runCli } from '../src/cli.js';

try {
  await runCli();
} catch (error) {
  if (isJsonMode()) {
    console.error(JSON.stringify({
      error: {
        code: 'internal_error',
        message: error.message,
        suggestion: null,
        retryable: false,
        details: {},
      },
    }, null, 2));
  } else {
    console.error(error.message || error);
  }
  process.exit(1);
}
