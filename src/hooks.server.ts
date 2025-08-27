// src/hooks.server.ts
import '$lib/otel.server';

import { SpanStatusCode, trace } from '@opentelemetry/api';
import type { Handle } from '@sveltejs/kit';

export const handle: Handle = async ({ event, resolve }) => {
  const tracer = trace.getTracer('sveltekit');
  const url = new URL(event.request.url);

  return await tracer.startActiveSpan(`HTTP ${event.request.method} ${url.pathname}`, async (span) => {
    try {
      span.setAttributes({
        'http.method': event.request.method,
        'http.route': url.pathname,
        'http.url': url.origin + url.pathname,
        'user_agent.original': event.request.headers.get('user-agent') ?? '',
        'cloud.region': process.env.AWS_REGION ?? '',
        // add CloudFront/Lambda@Edge details if available via env/headers:
        'faas.trigger': 'http',
        'faas.invocation_id': event.route?.id ?? '',
      });

      const response = await resolve(event);

      span.setAttributes({
        'http.status_code': response.status,
      });
      if (response.status >= 500) {
        span.setStatus({ code: SpanStatusCode.ERROR });
      } else {
        span.setStatus({ code: SpanStatusCode.OK });
      }
      return response;
    } catch (err: any) {
      span.recordException(err);
      span.setStatus({ code: SpanStatusCode.ERROR, message: String(err?.message ?? err) });
      throw err;
    } finally {
      // End the span *before* returning to improve flush chances in serverless
      span.end();

      // Optional: best-effort flush without blocking the request too long.
      // Avoid awaits in hot paths; a short timer strikes a balance.
      const otel = (globalThis as any)._otlpForceFlush as undefined | (() => Promise<void>);
      // (You can wire a global helper if you want an explicit flush.)

      console.log("OTEL Hook completed");
    }
  });
};