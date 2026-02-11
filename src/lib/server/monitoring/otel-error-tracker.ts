import type { Handle } from '@sveltejs/kit';
import { trace, context, SpanStatusCode } from '@opentelemetry/api';
import { AsyncLocalStorage } from 'node:async_hooks';
import type { Span, ReadableSpan, SpanProcessor } from '@opentelemetry/sdk-trace-base';

export const errorStorage = new AsyncLocalStorage<{
	hasError: boolean;
	errorMessages: string[];
	errorContext?: {
		location?: { file?: string; line?: number; function?: string };
		timestamp?: string;
	};
}>();

export const loadTimingStorage = new AsyncLocalStorage<{
	lastLoadEndTime: number;
	loadCount: number;
}>();

function extractErrorLocation(stack?: string) {
	if (!stack) return {};

	const lines = stack.split('\n');
	const relevant = lines.find(
		(l) => l.includes('/src/') && !l.includes('otel-error-tracker')
	);
	if (!relevant) return {};

	const match = relevant.match(
		/at\s+(?:async\s+)?([^\s]+)\s+\(([^:]+):(\d+):\d+\)/
	);
	if (match) {
		const [, fn, filePath, line] = match;
		return {
			file: filePath.split('/').pop(),
			line: parseInt(line),
			function: fn === 'eval' ? undefined : fn
		};
	}
	return {};
}

const originalConsoleError = console.error;
console.error = function (...args: any[]) {
	originalConsoleError.apply(console, args);

	const store = errorStorage.getStore();
	if (store && !store.hasError) {
		store.hasError = true;
		const message = args
			.map((a) => {
				if (typeof a === 'string') return a;
				if (a instanceof Error) return a.message;
				try {
					return JSON.stringify(a);
				} catch {
					return String(a);
				}
			})
			.join(' ');

		store.errorMessages.push(message);
		store.errorContext = {
			location: extractErrorLocation(new Error().stack),
			timestamp: new Date().toISOString()
		};
	}
};

/**
 * Renames sveltekit.load spans, tracks load timing, and marks error spans.
 */
export class ErrorTrackingSpanProcessor implements SpanProcessor {
	onStart(span: Span): void {
		if ((span as any).name === 'sveltekit.load') {
			const timing = loadTimingStorage.getStore();
			if (timing) timing.loadCount++;
		}
	}

	onEnd(span: ReadableSpan): void {
		const spanAny = span as any;

		if (span.name === 'sveltekit.load') {
			const nodeId = span.attributes?.['sveltekit.load.node_id'];
			if (nodeId) {
				spanAny.name = `load:${nodeId}`;
			}
		}

		if (span.name.startsWith('load:') || span.name === 'sveltekit.load') {
			const timing = loadTimingStorage.getStore();
			if (timing) {
				timing.lastLoadEndTime = Date.now();
			}
		}

		const store = errorStorage.getStore();
		if (store?.hasError) {
			const msg = store.errorMessages[0] || 'Error during request';
			spanAny._status = { code: SpanStatusCode.ERROR, message: msg };
			spanAny.recordException(new Error(msg));
			spanAny.setAttribute('error.from_console', true);
		}
	}

	forceFlush() {
		return Promise.resolve();
	}
	shutdown() {
		return Promise.resolve();
	}
}

export const otelErrorTracker: Handle = async ({ event, resolve }) => {
	const pathname = event.url.pathname;
	if (pathname.startsWith('/_app/') || pathname.startsWith('/favicon')) {
		return resolve(event);
	}

	return errorStorage.run({ hasError: false, errorMessages: [] }, async () => {
		const store = errorStorage.getStore()!;
		const response = await resolve(event);

		if (store.hasError) {
			const span = trace.getSpan(context.active());
			if (span) {
				const msg = store.errorMessages[0] || 'Error during request';
				span.setStatus({ code: SpanStatusCode.ERROR, message: msg });
				span.recordException(new Error(msg));
				span.setAttribute('error.from_console', true);
				span.setAttribute('error.message', msg);

				const loc = store.errorContext?.location;
				if (loc?.file) span.setAttribute('error.file', loc.file);
				if (loc?.line) span.setAttribute('error.line', loc.line);
				if (loc?.function) span.setAttribute('error.function', loc.function);

				if (store.errorContext?.timestamp) {
					span.setAttribute('error.timestamp', store.errorContext.timestamp);
				}
			}
		}

		return response;
	});
};
