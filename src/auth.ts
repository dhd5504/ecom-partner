import basicAuth from 'express-basic-auth';
import { RequestHandler } from 'express';

const user = process.env.AUTH_USER ?? 'admin';
const pass = process.env.AUTH_PASS ?? '';

/**
 * HTTP Basic Auth middleware.
 * Browser tự hiện popup login, không cần login.html hay session.
 */
export const requireAuth: RequestHandler = basicAuth({
  users: { [user]: pass },
  challenge: true,          // Trả về WWW-Authenticate header → browser hiện popup
  realm: 'Partner Dashboard',
});

// Alias dùng chung cho cả page routes và API routes
export const requireAuthApi: RequestHandler = requireAuth;
