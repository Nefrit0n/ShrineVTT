import { Router } from 'express';

const router = Router();

router.get('/', (req, res) => {
  const rssMB = Math.round((process.memoryUsage().rss / 1024 / 1024) * 100) / 100;

  res.json({
    ok: true,
    pid: process.pid,
    uptime: process.uptime(),
    rssMB,
  });
});

export default router;
