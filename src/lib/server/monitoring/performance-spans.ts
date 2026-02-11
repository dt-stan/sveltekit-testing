import { trace, context, SpanStatusCode } from '@opentelemetry/api';

export interface TrackOperationOptions {
	[key: string]: string | boolean | number | undefined;
}

export async function trackOperation<T>(
	name: string,
	operation: () => Promise<T>,
	attributes: TrackOperationOptions = {}
): Promise<T> {
	const tracer = trace.getTracer('ssr-performance', '1.0.0');
	const activeContext = context.active();

	const spanAttributes: Record<string, string | boolean | number> = {};
	for (const [key, value] of Object.entries(attributes)) {
		if (value !== undefined) {
			spanAttributes[key] = value;
		}
	}

	const span = tracer.startSpan(name, { attributes: spanAttributes }, activeContext);

	try {
		const result = await context.with(
			trace.setSpan(activeContext, span),
			() => operation()
		);
		span.setStatus({ code: SpanStatusCode.OK });
		return result;
	} catch (error) {
		span.setStatus({
			code: SpanStatusCode.ERROR,
			message: error instanceof Error ? error.message : String(error)
		});
		span.recordException(error instanceof Error ? error : new Error(String(error)));
		throw error;
	} finally {
		span.end();
	}
}
