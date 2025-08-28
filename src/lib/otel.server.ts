// src/lib/server/otel.ts
import { diag, DiagConsoleLogger, DiagLogLevel } from '@opentelemetry/api';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { UndiciInstrumentation } from '@opentelemetry/instrumentation-undici';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { ATTR_SERVICE_NAME } from '@opentelemetry/semantic-conventions';

declare global {
  // eslint-disable-next-line no-var
  var __otelInitialized: boolean | undefined;
}

if (!globalThis.__otelInitialized) {
  // Optional: turn on internal OTel diagnostics when debugging
  if (process.env.OTEL_DIAGNOSTICS === '1') {
    diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.INFO);
  }

  console.log("--------------------------------");
  console.log(process.env);
  console.log("--------------------------------");

  console.log("----ATTEMPTING File Read----");
  let fs = require('fs');
  fs.readdirSync('./').forEach((file: string) => {
    console.log(file);
  });
  console.log("----END File Read----");

  const resource = resourceFromAttributes({
    [ATTR_SERVICE_NAME]: process.env.OTEL_SERVICE_NAME ?? 'sveltekit-testing',
  });

  if (!process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT) {
    console.log("OTEL EXPORTER URL Not Found");
  }

  if (!process.env.OTLP_AUTH_HEADER){
    console.log("OTEL API Token Not Found");
  }

  const traceExporter = new OTLPTraceExporter({
    // e.g. https://your-otlp.example.com/v1/traces
    url: process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT
      ?? process.env.OTEL_EXPORTER_OTLP_ENDPOINT
      ?? undefined,
    headers: {
      // Example for backends that expect an API token in Authorization
      // (adjust header key/value to your backend’s requirement)
      Authorization: process.env.OTLP_AUTH_HEADER
        ?? process.env.OTEL_EXPORTER_OTLP_HEADERS /* supports "k=v,k2=v2" */
        ?? '',
    },
    // keep default concurrency/batching
  });

  const sdk = new NodeSDK({
    resource,
    traceExporter,
    instrumentations: [
      // broad auto-instrumentations (fs/http/dns…); safe for serverless
      getNodeAutoInstrumentations({
        // Small hardening for serverless:
        '@opentelemetry/instrumentation-fs': { enabled: false },
      }),
      new UndiciInstrumentation(),
    ],
  });

  // Start immediately at module load so it runs before app code
  try {
    sdk.start();
    console.log("OTEL SDK Started");
  } catch (e) {
    console.error('OTel init failed:', e);
  }  

  // Best-effort flushing when the runtime is being torn down
  // (Lambda may freeze the process; this is still useful during local/dev)
  process.on('beforeExit', () => sdk.shutdown().catch(()=>{}));

  globalThis.__otelInitialized = true;
}