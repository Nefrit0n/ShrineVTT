import { Router } from "express";

import { authenticateUser } from "#auth/authService.js";
import {
  createSession,
  deleteSession,
  getSessionByToken,
} from "#auth/sessionService.js";
import { requireAuth } from "#auth/middleware.js";

const router = Router();

router.post("/login", async (req, res) => {
  const { username, password } = req.body ?? {};

  if (!username || !password) {
    return res
      .status(400)
      .json({ error: "Username and password are required" });
  }

  const user = await authenticateUser(username, password);

  if (!user) {
    return res.status(401).json({ error: "Invalid credentials" });
  }

  const { token } = await createSession(user.id);

  return res.json({
    token,
    user: {
      id: user.id,
      username: user.username,
      role: user.role,
    },
  });
});

router.post("/logout", requireAuth, async (req, res) => {
  await deleteSession(req.token);

  return res.status(204).send();
});

router.get("/me", requireAuth, async (req, res) => {
  const session = await getSessionByToken(req.token);

  if (!session) {
    return res.status(401).json({ error: "Session expired" });
  }

  return res.json({
    token: req.token,
    user: {
      id: session.user.id,
      username: session.user.username,
      role: session.user.role,
    },
  });
});

export default router;
