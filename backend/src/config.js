const DEFAULT_PORT = 8080;

export const config = {
  port: Number.parseInt(process.env.PORT ?? '', 10) || DEFAULT_PORT,
};

export default config;
