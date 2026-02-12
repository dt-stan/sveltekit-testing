import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-proto';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { ATTR_SERVICE_NAME } from '@opentelemetry/semantic-conventions';
import { ConsoleInstrumentation } from '@sovarto/opentelemetry-instrumentation-console';
import { BatchSpanProcessor } from '@opentelemetry/sdk-trace-base';
import { SpanStatusCode } from '@opentelemetry/api';
import { createAddHookMessageChannel } from 'import-in-the-middle';
import { register } from 'module';

import {
	OTEL_SERVICE_NAME,
	OTEL_EXPORTER_OTLP_TRACES_ENDPOINT,
	OTEL_EXPORTER_OTLP_ENDPOINT,
	OTLP_AUTH_HEADER,
	OTEL_EXPORTER_OTLP_HEADERS
} from '$env/static/private';

import { ErrorTrackingSpanProcessor } from '$lib/server/monitoring/otel-error-tracker';

const { registerOptions } = createAddHookMessageChannel();
register('import-in-the-middle/hook.mjs', import.meta.url, registerOptions);

const serviceName = OTEL_SERVICE_NAME ?? 'sveltekit-testing-intobs';

const resource = resourceFromAttributes({
	[ATTR_SERVICE_NAME]: serviceName
});

const headers = {
	Authorization: OTLP_AUTH_HEADER ?? OTEL_EXPORTER_OTLP_HEADERS ?? ''
};

/**
 * Walks up the parent span chain from error spans and marks ancestors as errors.
 * Ensures the full trace is flagged when a console.error occurs in any child span.
 */
class ErrorPropagatingExporter extends OTLPTraceExporter {
	async export(spans: any, resultCallback: any) {
		const spanMap = new Map<string, any>();
		const errorSpanIds = new Set<string>();

		spans.forEach((s: any) => {
			const id = s._spanContext?.spanId;
			if (id) spanMap.set(id, s);
			if (
				s.attributes?.['error.from_console'] ||
				(s.status?.code ?? 0) === 2
			) {
				if (id) errorSpanIds.add(id);
			}
		});

		if (errorSpanIds.size > 0) {
			const errorAncestorIds = new Set<string>();
			errorSpanIds.forEach((id) => {
				let current = spanMap.get(id);
				while (current) {
					const parentId = current.parentSpanContext?.spanId;
					if (parentId) {
						errorAncestorIds.add(parentId);
						current = spanMap.get(parentId);
					} else break;
				}
			});

			spans.forEach((span: any) => {
				const shouldMarkError =
					span.attributes?.['error.from_console'] ||
					errorAncestorIds.has(span._spanContext?.spanId) ||
					(span.status?.code ?? 0) === 2;

				if (shouldMarkError) {
					span.status = {
						code: SpanStatusCode.ERROR,
						message:
							span.attributes?.['error.message'] || 'Error during request'
					};
					span.attributes = {
						...span.attributes,
						'error.overridden_by_exporter': true
					};
				}
			});
		}

		return super.export(spans, resultCallback);
	}
}

const traceExporter = new ErrorPropagatingExporter({
	url:
		OTEL_EXPORTER_OTLP_TRACES_ENDPOINT ??
		OTEL_EXPORTER_OTLP_ENDPOINT ??
		undefined,
	headers
});

const errorTrackingProcessor = new ErrorTrackingSpanProcessor();
const batchSpanProcessor = new BatchSpanProcessor(traceExporter);

const sdk = new NodeSDK({
	resource,
	spanProcessors: [errorTrackingProcessor, batchSpanProcessor],
	instrumentations: [getNodeAutoInstrumentations(), new ConsoleInstrumentation()]
});

try {
	sdk.start();
	console.log(`OTEL SDK started: ${serviceName}`);
} catch (e) {
	console.error('OTEL init failed:', e);
}

process.on('SIGTERM', () => {
	batchSpanProcessor.forceFlush().finally(() => process.exit(0));
});
