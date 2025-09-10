import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-proto';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { ATTR_SERVICE_NAME } from '@opentelemetry/semantic-conventions';
// import { createAddHookMessageChannel } from 'import-in-the-middle';
// import { register } from 'module';

// Francois Commit
import {
    OTEL_SERVICE_NAME,
    OTEL_EXPORTER_OTLP_TRACES_ENDPOINT,
    OTEL_EXPORTER_OTLP_ENDPOINT,
    OTLP_AUTH_HEADER,
    OTEL_EXPORTER_OTLP_HEADERS,
    OTEL_DIAGNOSTICS
} from '$env/static/private';

// const { registerOptions } = createAddHookMessageChannel();
// register('import-in-the-middle/hook.mjs', import.meta.url, registerOptions);

console.log("--------------------------------");
console.log({
OTEL_SERVICE_NAME,
OTEL_EXPORTER_OTLP_TRACES_ENDPOINT,
OTEL_EXPORTER_OTLP_ENDPOINT,
OTLP_AUTH_HEADER,
OTEL_EXPORTER_OTLP_HEADERS,
OTEL_DIAGNOSTICS
});
console.log("--------------------------------");

const resource = resourceFromAttributes({
    [ATTR_SERVICE_NAME]: OTEL_SERVICE_NAME ?? 'sveltekit-testing-intobs'
});

const sdk = new NodeSDK({
	resource,
	traceExporter: new OTLPTraceExporter({
        // e.g. https://your-otlp.example.com/v1/traces
        url: OTEL_EXPORTER_OTLP_TRACES_ENDPOINT
             ?? OTEL_EXPORTER_OTLP_ENDPOINT
             ?? undefined,
        headers: {
            Authorization: OTLP_AUTH_HEADER
                           ?? OTEL_EXPORTER_OTLP_HEADERS
                           ?? '',
        }
    }),
	instrumentations: [getNodeAutoInstrumentations()]
});
try{
    sdk.start();
    console.log("OTEL SDK Started");
} catch (e) {
    console.error("OTEL init failed:", e);
}