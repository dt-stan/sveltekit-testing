import type { Handle } from '@sveltejs/kit';
import { sequence } from '@sveltejs/kit/hooks';
import { trace, context, SpanStatusCode } from '@opentelemetry/api';
import {
	otelErrorTracker,
	loadTimingStorage
} from '$lib/server/monitoring/otel-error-tracker';
import { trackOperation } from '$lib/server/monitoring/performance-spans';

const isAssetPath = (pathname: string): boolean =>
	pathname.startsWith('/_app/') || pathname.startsWith('/favicon');

const isApiRoute = (pathname: string): boolean =>
	pathname.startsWith('/api/');

/**
 * Propagates trace context from client-side Dynatrace RUM.
 * Reads W3C traceparent header and continues the trace instead of creating a new one.
 */
const tracePropagationInterceptor: Handle = async ({ event, resolve }) => {
	const traceparent = event.request.headers.get('traceparent');

	if (traceparent) {
		const parts = traceparent.split('-');
		if (parts.length === 4) {
			const [, traceId, parentSpanId, flags] = parts;
			const remoteSpanContext = {
				traceId,
				spanId: parentSpanId,
				traceFlags: parseInt(flags, 16),
				isRemote: true
			};

			const ctxWithRemoteParent = trace.setSpanContext(
				context.active(),
				remoteSpanContext
			);

			return await context.with(ctxWithRemoteParent, () => resolve(event));
		}
	}

	return await resolve(event);
};

/**
 * Extract Dynatrace cookies to correlate server spans with browser sessions.
 */
const dynatraceCookieExtractor: Handle = async ({ event, resolve }) => {
	const span = trace.getSpan(context.active());

	if (span) {
		const dtCookie = event.cookies.get('dtCookie') ?? '';
		const browserMatch = dtCookie.match(/_sn_([A-Z0-9]+)_/);
		if (browserMatch?.[1]) {
			span.setAttribute('browser_session_id', browserMatch[1]);
		}

		const userID = event.cookies.get('rxVisitor');
		if (userID) {
			span.setAttribute('user_id', userID);
		}

		const dtPC = event.cookies.get('dtPC') ?? '';
		const sessionMatch = dtPC.match(/h-v([^-]+-\d+)e0/);
		if (sessionMatch?.[1]) {
			span.setAttribute('session_id', sessionMatch[1]);
		}
	}

	return await resolve(event);
};

/**
 * Initialize load timing storage for each request.
 * Allows measuring the gap between load() completion and component rendering.
 */
const loadTimingTracker: Handle = async ({ event, resolve }) => {
	return loadTimingStorage.run({ lastLoadEndTime: 0, loadCount: 0 }, () =>
		resolve(event)
	);
};

/**
 * Wraps the full SSR resolution in a span. Skips assets and API routes.
 */
const ssrRenderingTracker: Handle = async ({ event, resolve }) => {
	const pathname = event.url.pathname;

	if (isAssetPath(pathname) || isApiRoute(pathname)) {
		return await resolve(event);
	}

	return await trackOperation('ssr.render', () => resolve(event), {
		pathname,
		'render.type': 'ssr',
		'operation.type': 'layout_load'
	});
};

/**
 * Creates ssr.svelte.render span measuring actual component rendering time.
 * Uses transformPageChunk to detect when the first HTML chunk is produced —
 * the gap between last load() end and first chunk is the rendering duration.
 */
const addSsrRenderSpan: Handle = async ({ event, resolve }) => {
	const pathname = event.url.pathname;

	if (isAssetPath(pathname) || isApiRoute(pathname)) {
		return resolve(event);
	}

	let firstChunkReceived = false;

	return await resolve(event, {
		transformPageChunk: ({ html }) => {
			if (!firstChunkReceived) {
				firstChunkReceived = true;
				const firstChunkTime = Date.now();
				const loadTiming = loadTimingStorage.getStore();

				if (loadTiming && loadTiming.lastLoadEndTime > 0) {
					const renderingDuration = firstChunkTime - loadTiming.lastLoadEndTime;
					const tracer = trace.getTracer('ssr-rendering', '1.0.0');

					const renderingSpan = tracer.startSpan(
						'ssr.svelte.render',
						{
							startTime: loadTiming.lastLoadEndTime,
							attributes: {
								pathname,
								'operation.type': 'layout_load',
								'render.phase': 'component-rendering',
								'render.duration_ms': renderingDuration,
								'render.load_count': loadTiming.loadCount
							}
						},
						context.active()
					);
					renderingSpan.setStatus({ code: SpanStatusCode.OK });
					renderingSpan.end(firstChunkTime);
				}
			}

			return html;
		}
	});
};

export const handle = sequence(
	tracePropagationInterceptor,
	loadTimingTracker,
	ssrRenderingTracker,
	dynatraceCookieExtractor,
	addSsrRenderSpan,
	otelErrorTracker
);
