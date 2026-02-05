// Import type extensions for side effects (augments Fastify types)
import "./type-extensions.js";

export { configureContainer, type AppSingletonCradle } from "./singleton.js";

export { configureRequestScope, type AppRequestCradle } from "./request.js";

export { registerDependencyInjection } from "./plugin.js";
