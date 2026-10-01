import { buildApp } from "./app.js";
import { config } from "./config.js";

const app = await buildApp();

try {
  await app.listen({ port: config.port, host: config.host });
  app.log.info(`Mizan sync server listening on :${config.port} (data: ${config.dataDir})`);
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
