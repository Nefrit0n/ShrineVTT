import pino from 'pino';

const logLevel = process.env.LOG_LEVEL ?? 'info';

export const baseLogger = pino({
  level: logLevel,
});

function buildContext(bindings = {}) {
  if (!bindings || typeof bindings !== 'object') {
    return {};
  }

  const context = {};
  for (const [key, value] of Object.entries(bindings)) {
    if (value === undefined) {
      continue;
    }

    if (key === 'rid' || key === 'userId' || key === 'roomId') {
      context[key] = value;
      continue;
    }

    context[key] = value;
  }

  return context;
}

export function createChildLogger(bindings = {}, parentLogger = baseLogger) {
  const parent = parentLogger ?? baseLogger;

  if (!parent?.child) {
    throw new TypeError('Invalid parent logger provided');
  }

  const context = buildContext(bindings);

  if (Object.keys(context).length === 0) {
    return parent;
  }

  return parent.child(context);
}

export default baseLogger;
