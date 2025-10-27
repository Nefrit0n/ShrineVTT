const QUERY_HANDLERS = new Map();

function register(type, handler) {
  if (!type || typeof type !== 'string') {
    throw new TypeError('Query type must be a non-empty string');
  }

  if (typeof handler !== 'function') {
    throw new TypeError(`Query handler for "${type}" must be a function`);
  }

  QUERY_HANDLERS.set(type, handler);
}

export function getQueryHandler(type) {
  return QUERY_HANDLERS.get(type) ?? null;
}

export async function executeQuery(type, input) {
  const handler = getQueryHandler(type);
  if (!handler) {
    throw new Error(`Unknown query: ${type}`);
  }

  return handler(input);
}

register('readme.info', async () => ({
  app: 'ShrineVTT',
  stage: '1.7',
  description: 'CQRS-lite read model placeholder',
}));

export default {
  register,
  getQueryHandler,
  executeQuery,
};
