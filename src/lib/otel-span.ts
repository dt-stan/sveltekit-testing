// src/lib/otel-span.ts
import { trace, context } from '@opentelemetry/api';

export function recordErrorToCurrentSpan(error: unknown) {
  const span = trace.getSpan(context.active());
  if (span) {
    span.recordException(error);
    span.setStatus({ code: 2, message: String(error) }); // 2 = ERROR
  }
}
