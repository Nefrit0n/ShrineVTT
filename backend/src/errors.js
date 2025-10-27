export class DomainError extends Error {
  constructor(message, { code = 'DOMAIN_ERROR' } = {}) {
    super(message);
    this.name = 'DomainError';
    this.code = code;
  }
}

export class HttpError extends Error {
  constructor(statusCode, message, { code = 'HTTP_ERROR' } = {}) {
    super(message);
    this.name = 'HttpError';
    this.statusCode = statusCode;
    this.code = code;
  }
}

const INTERNAL_ERROR_RESPONSE = {
  statusCode: 500,
  code: 'INTERNAL_SERVER_ERROR',
  message: 'Internal Server Error',
};

function mapError(err) {
  if (err instanceof HttpError) {
    return {
      statusCode: err.statusCode,
      code: err.code,
      message: err.message,
    };
  }

  if (err instanceof DomainError) {
    return {
      statusCode: 400,
      code: err.code,
      message: err.message,
    };
  }

  return { ...INTERNAL_ERROR_RESPONSE };
}

export function createErrorHandler(logger) {
  // eslint-disable-next-line no-unused-vars
  return (err, req, res, next) => {
    const { statusCode, code, message } = mapError(err);

    logger.error({ err, code, statusCode }, 'Request failed');

    if (res.headersSent) {
      return;
    }

    res.status(statusCode).json({ error: { code, message } });
  };
}

export function notFoundHandler(req, res) {
  res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Not Found' } });
}
