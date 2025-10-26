import { Router } from "express";

import { requireAuth, requireRole, RolesEnum } from "#auth/middleware.js";

const router = Router();

router.get("/me", requireAuth, (req, res) => {
  res.json({
    user: {
      id: req.user.id,
      username: req.user.username,
      role: req.user.role,
    },
    session: req.session,
  });
});

router.post(
  "/master/broadcast",
  requireAuth,
  requireRole(RolesEnum.MASTER),
  (req, res) => {
    const { message } = req.body ?? {};

    if (!message) {
      return res.status(400).json({ error: "Message is required" });
    }

    return res.json({ status: "queued", message });
  }
);

export default router;
