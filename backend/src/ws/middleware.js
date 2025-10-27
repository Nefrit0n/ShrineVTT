export default function registerWsMiddleware(namespace, _context = {}) {
  namespace.use((socket, next) => {
    // TODO: implement token-based authentication
    next();
  });
}
