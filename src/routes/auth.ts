import { Router, Request, Response } from 'express';

const router = Router();

/** POST /api/login — authenticate with username/password from env */
router.post('/api/login', (req: Request, res: Response): void => {
  const { username, password } = req.body as { username?: string; password?: string };

  const expectedUser = process.env.AUTH_USER ?? '';
  const expectedPass = process.env.AUTH_PASS ?? '';

  if (!username || !password) {
    res.status(400).json({ status: 'error', message: 'Username and password required' });
    return;
  }

  if (username === expectedUser && password === expectedPass) {
    req.session.authenticated = true;
    req.session.save((err) => {
      if (err) {
        res.status(500).json({ status: 'error', message: 'Session save failed' });
        return;
      }
      res.json({ status: 'success', data: { authenticated: true } });
    });
  } else {
    res.status(401).json({ status: 'error', message: 'Invalid credentials' });
  }
});

/** POST /api/logout — destroy session */
router.post('/api/logout', (req: Request, res: Response): void => {
  req.session.destroy((err) => {
    if (err) {
      res.status(500).json({ status: 'error', message: 'Logout failed' });
      return;
    }
    res.json({ status: 'success', data: { authenticated: false } });
  });
});

/** GET /api/auth/check — check authentication status */
router.get('/api/auth/check', (req: Request, res: Response): void => {
  res.json({
    status: 'success',
    data: { authenticated: req.session.authenticated === true },
  });
});

export default router;
