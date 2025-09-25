import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-proto';
import { OTLPLogExporter } from '@opentelemetry/exporter-logs-otlp-proto';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { ATTR_SERVICE_NAME } from '@opentelemetry/semantic-conventions';
import { ConsoleInstrumentation } from '@sovarto/opentelemetry-instrumentation-console';
import { BatchLogRecordProcessor } from '@opentelemetry/sdk-logs';
import { BatchSpanProcessor } from '@opentelemetry/sdk-trace-base';
import { createAddHookMessageChannel } from 'import-in-the-middle';
import { register } from 'module';

// import { diag, DiagConsoleLogger, DiagLogLevel } from '@opentelemetry/api';
// diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.DEBUG);

// Francois Commit
import {
    OTEL_SERVICE_NAME,
    OTEL_EXPORTER_OTLP_TRACES_ENDPOINT,
    OTEL_EXPORTER_OTLP_LOGS_ENDPOINT,
    OTEL_EXPORTER_OTLP_ENDPOINT,
    OTLP_AUTH_HEADER,
    OTEL_EXPORTER_OTLP_HEADERS,
    OTEL_DIAGNOSTICS
} from '$env/static/private';

const { registerOptions } = createAddHookMessageChannel();
register('import-in-the-middle/hook.mjs', import.meta.url, registerOptions);

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

const traceExporter = new OTLPTraceExporter({
        // e.g. https://your-otlp.example.com/v1/traces
        url: OTEL_EXPORTER_OTLP_TRACES_ENDPOINT
             ?? OTEL_EXPORTER_OTLP_ENDPOINT
             ?? undefined,
        headers: {
            Authorization: OTLP_AUTH_HEADER
                           ?? OTEL_EXPORTER_OTLP_HEADERS
                           ?? '',
        },
        // timeoutMillis: 10
    });

export const batchSpanProcessor = new BatchSpanProcessor(traceExporter);

const logExporter = new OTLPLogExporter({
    url: OTEL_EXPORTER_OTLP_LOGS_ENDPOINT
         ?? OTEL_EXPORTER_OTLP_ENDPOINT
         ?? undefined,
    headers: {
        Authorization: OTLP_AUTH_HEADER
                        ?? OTEL_EXPORTER_OTLP_HEADERS
                        ?? '',
    },
    timeoutMillis: 10
});

const sdk = new NodeSDK({
	resource,
    spanProcessor: batchSpanProcessor,
    logRecordProcessor: new BatchLogRecordProcessor(logExporter),
	instrumentations: [getNodeAutoInstrumentations(), new ConsoleInstrumentation()]
});

try{
    sdk.start();
    console.log("OTEL SDK Started");
} catch (e) {
    console.error("OTEL init failed:", e);
}

// process.on('SIGTERM', () => {
//   sdk.shutdown()
//     .then(() => console.log('OpenTelemetry SDK terminated'))
//     .catch((error) => console.error('Error terminating OpenTelemetry SDK', error))
//     .finally(() => process.exit(0));
// });