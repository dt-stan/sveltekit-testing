// src/hooks.server.ts
import type { Handle } from '@sveltejs/kit';
import { context, trace, SpanKind } from '@opentelemetry/api';
import { 
  simpleSpanProcessor,
  // batchLogProcessor
} from './instrumentation.server';

export const handle: Handle = async ({ event, resolve }) => {
  // Try to get the current active span
  let span = trace.getSpan(context.active());
  
  if (span) {
    // Try to grab Dynatrace Cookies
    const dtCookie = event.cookies.get("dtCookie") ?? "";

    const browserSessionIdRegex = dtCookie.match(/_sn_([A-Z0-9]+)_/);
    const browserSessionId: string = browserSessionIdRegex?.[1] ?? "";

    if (browserSessionId){
      console.log("Extracted browser session ID:", browserSessionId);
      span.setAttribute("browser_session_id", browserSessionId);
    }

    const userID = event.cookies.get("rxVisitor") ?? "";

    if (userID){
      console.log(`Setting DT User ID - '${userID}'`);
      span.setAttribute("user_id", userID);
    }

    const dtPCCookie = event.cookies.get("dtPC") ?? "";

    const sessionIdRegex = dtPCCookie.match(/h-v([^-]+-\d+)e0/);
    const sessionId = sessionIdRegex ? sessionIdRegex[1] : null;

    if (sessionId){
      console.log("Setting DT RUM session ID:", sessionId);
      span.setAttribute("session_id", sessionId);
    }
  }

  // Proceed with the request
  try {
    return await resolve(event);
  } finally {
    if (span) {
      console.log("Flushing Buffers");
      // await simpleSpanProcessor.forceFlush();
      // await batchLogProcessor.forceFlush();
    }
  }
}
