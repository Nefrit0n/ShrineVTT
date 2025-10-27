import { Router } from 'express';

const router = Router();

router.get('/', (req, res) => {
  res.json({
    ok: true,
    ts: Date.now(),
    pid: process.pid,
  });
});

export default router;
