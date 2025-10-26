import { getSessionByToken } from "./sessionService.js";
import { Roles } from "./roles.js";

const extractToken = (req) => {
  const header = req.headers.authorization;

  if (header?.startsWith("Bearer ")) {
    return header.slice("Bearer ".length);
  }

  if (req.query?.token) {
    return req.query.token;
  }

  return null;
};

export const requireAuth = async (req, res, next) => {
  const token = extractToken(req);

  if (!token) {
    return res.status(401).json({ error: "Authentication required" });
  }

  const session = await getSessionByToken(token);

  if (!session) {
    return res.status(401).json({ error: "Invalid session token" });
  }

  req.session = session.session;
  req.user = session.user;
  req.token = token;

  return next();
};

export const requireRole = (role) => (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ error: "Authentication required" });
  }

  if (req.user.role !== role) {
    return res.status(403).json({ error: `Requires role ${role}` });
  }

  return next();
};

export const RolesEnum = Roles;
