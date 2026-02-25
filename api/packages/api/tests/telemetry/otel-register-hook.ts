import { register } from "node:module";
import { pathToFileURL } from "node:url";

// Register the OTel ESM loader hook in the vitest worker process
// so that HttpInstrumentation can wrap the http module.
register("@opentelemetry/instrumentation/hook.mjs", pathToFileURL(import.meta.url).href);
