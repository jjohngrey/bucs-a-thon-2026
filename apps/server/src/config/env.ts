const DEFAULT_PORT = 3001;

function parsePort(value: string | undefined): number {
  const parsed = Number(value);

  if (!value || Number.isNaN(parsed) || parsed <= 0) {
    return DEFAULT_PORT;
  }

  return parsed;
}

export const env = {
  nodeEnv: process.env.NODE_ENV ?? "development",
  port: parsePort(process.env.PORT),
  host: process.env.HOST ?? "127.0.0.1",
  clientOrigin: process.env.CLIENT_ORIGIN ?? "*",
};
