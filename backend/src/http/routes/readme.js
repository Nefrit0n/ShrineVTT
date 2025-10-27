import { Router } from 'express';
import { executeQuery } from '../../application/queries/index.js';

const router = Router();

router.get('/info', async (req, res, next) => {
  try {
    const result = await executeQuery('readme.info', {
      context: {
        ip: req.ip,
        userAgent: req.get('user-agent') ?? null,
      },
      req,
    });

    res.json(result);
  } catch (err) {
    next(err);
  }
});

export default router;
