import session from 'express-session';
import { RequestHandler, Request, Response, NextFunction } from 'express';

// Extend express-session to include our custom fields
declare module 'express-session' {
  interface SessionData {
    authenticated: boolean;
  }
}

export const sessionMiddleware: RequestHandler = session({
  secret: process.env.SESSION_SECRET ?? 'fallback-secret-change-me',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 8 * 60 * 60 * 1000, // 8 hours
  },
});

/** Protect page routes — redirect to /login if not authenticated */
export const requireAuth: RequestHandler = (req: Request, res: Response, next: NextFunction): void => {
  if (req.session.authenticated) {
    next();
  } else {
    res.redirect('/login');
  }
};

/** Protect API routes — return 401 JSON if not authenticated */
export const requireAuthApi: RequestHandler = (req: Request, res: Response, next: NextFunction): void => {
  if (req.session.authenticated) {
    next();
  } else {
    res.status(401).json({ status: 'error', message: 'Unauthorized' });
  }
};
