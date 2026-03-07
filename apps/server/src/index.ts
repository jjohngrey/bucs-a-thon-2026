import { createHttpApp } from "./http/app.js";
import { createSocketServer } from "./sockets/io.js";
import { env } from "./config/env.js";

const httpServer = createHttpApp();
createSocketServer(httpServer);

httpServer.listen(env.port, env.host, () => {
  console.log(`[server] listening on http://${env.host}:${env.port}`);
});
