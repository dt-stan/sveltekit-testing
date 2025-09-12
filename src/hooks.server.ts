// src/hooks.server.ts

import type { HandleServerError } from '@sveltejs/kit';
import { recordErrorToCurrentSpan } from '$lib/otel-span';

export const _handleError: HandleServerError = ({ error }) => {

  // Log the error to the server console
  console.error('Server error:', error);

  // Send error to OpenTelemetry span
  recordErrorToCurrentSpan(error);

  // Return a custom error object (optional)
  return {
    message: 'An unexpected error occurred on the server.',
    code: error?.code ?? 'UNKNOWN',
  };
};
