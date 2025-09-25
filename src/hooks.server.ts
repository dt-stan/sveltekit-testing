// src/hooks.server.ts
import type { Handle } from '@sveltejs/kit';
import { context, trace, SpanKind } from '@opentelemetry/api';
import { NodeTracerProvider } from '@opentelemetry/sdk-trace-node';

const tracer = trace.getTracer('sveltekit-hooks');
const provider = new NodeTracerProvider();
provider.register();

export const handle: Handle = async ({ event, resolve }) => {
  // Try to get the current active span
  let span = trace.getSpan(context.active());
  let createdNewSpan = false;

  if (!span){
    // No active span found, create a new one
    span = tracer.startSpan('sveltekit-hooks', {
        kind: SpanKind.INTERNAL
    });
    createdNewSpan = true;
    console.log("Creating a new span to associate user cookie with.");
  }


  try {
    span.setAttribute('test', "foobar");
    // Access the Dynatrace dtCookie to extract a session attribute
    const rawCookie = event.cookies.get("dtCookie") ?? "";

    const match = rawCookie.match(/_sn_([A-Z0-9]+)_/);
    const sessionId: string = match?.[1] ?? "";

    console.log("Extracted session ID:", sessionId);

    span.setAttribute("session_id", sessionId);

    // Proceed with the request
    const response = await resolve(event);
    await provider.forceFlush();
  
    return response;
  } catch (error) {
    span.recordException(error);
    throw error;
  } finally {
    if (createdNewSpan) {
        span.end();
    }
  }
};
