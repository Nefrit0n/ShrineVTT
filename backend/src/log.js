import pino from 'pino';

const logLevel = process.env.LOG_LEVEL ?? 'info';

const log = pino({
  level: logLevel,
});

export default log;
