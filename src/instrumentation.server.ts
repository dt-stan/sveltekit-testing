import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-proto';
import { createAddHookMessageChannel } from 'import-in-the-middle';
import { register } from 'node:module';
import {
  OTEL_SERVICE_NAME,
  OTLP_AUTH_HEADER,
  OTEL_EXPORTER_OTLP_TRACES_ENDPOINT
} from '$env/static/private';
const { registerOptions } = createAddHookMessageChannel();
register('import-in-the-middle/hook.mjs', import.meta.url, registerOptions);

const sdk = new NodeSDK({
	serviceName: OTEL_SERVICE_NAME,
	traceExporter: new OTLPTraceExporter({
		// e.g. https://your-otlp.example.com/v1/traces
		url: OTEL_EXPORTER_OTLP_TRACES_ENDPOINT
		  ?? '',
		headers: OTLP_AUTH_HEADER ? {
		  // Example for backends that expect an API token in Authorization
		  // (adjust header key/value to your backend’s requirement)
		  Authorization: `Api-token ${OTLP_AUTH_HEADER}` ,
		} : {},
		// keep default concurrency/batching
	  }),
	instrumentations: [
		  // broad auto-instrumentations (fs/http/dns…); safe for serverless
		  getNodeAutoInstrumentations({
			// Small hardening for serverless:
			'@opentelemetry/instrumentation-fs': { enabled: false },
		  })
		],
});

sdk.start();