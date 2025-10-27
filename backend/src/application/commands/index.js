const COMMAND_HANDLERS = new Map();

function register(type, handler) {
  if (!type || typeof type !== 'string') {
    throw new TypeError('Command type must be a non-empty string');
  }

  if (typeof handler !== 'function') {
    throw new TypeError(`Command handler for "${type}" must be a function`);
  }

  COMMAND_HANDLERS.set(type, handler);
}

export function getCommandHandler(type) {
  return COMMAND_HANDLERS.get(type) ?? null;
}

export async function executeCommand(type, input) {
  const handler = getCommandHandler(type);
  if (!handler) {
    throw new Error(`Unknown command: ${type}`);
  }

  return handler(input);
}

register('demo.echo', async ({ payload }) => ({
  type: 'demo.echo.result',
  payload,
}));

export default {
  register,
  getCommandHandler,
  executeCommand,
};
