// src/hooks.server.ts
import type { Handle } from '@sveltejs/kit';
import { context, trace, SpanKind } from '@opentelemetry/api';
import { 
  batchSpanProcessor,
  batchLogProcessor
} from './instrumentation.server';

export const handle: Handle = async ({ event, resolve }) => {
  // Try to get the current active span
  let span = trace.getSpan(context.active());
  
  if (span) {
    // Try to grab Dynatrace Cookies
    // const rawCookie = event.cookies.get("dtCookie") ?? "";

    // const match = rawCookie.match(/_sn_([A-Z0-9]+)_/);
    // const sessionId: string = match?.[1] ?? "";

    // console.log("Extracted session ID:", sessionId);

    // span.setAttribute("session_id", sessionId);
    const userID = event.cookies.get("rxVisitor") ?? "";

    if (userID){
      console.log(`Setting DT User ID - '${userID}'`);
      span.setAttribute("user-id", userID);
    }
  }

  // Proceed with the request
  const response = await resolve(event);

  if (span) {
    console.log("Flushing Buffers");
    await batchSpanProcessor.forceFlush();
    await batchLogProcessor.forceFlush();
  }
  
  return response;
}