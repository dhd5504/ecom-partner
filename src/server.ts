import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import path from 'path';
import { sessionMiddleware, requireAuth, requireAuthApi } from './auth';
import authRouter from './routes/auth';
import analyticsRouter from './routes/analytics';

const app = express();
const PORT = parseInt(process.env.PORT ?? '3001', 10);

// Body parsing
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Session
app.use(sessionMiddleware);

// Static files (public/)
app.use(express.static(path.join(__dirname, '..', 'public')));

// Root redirect based on auth state
app.get('/', (req, res): void => {
  if (req.session.authenticated) {
    res.redirect('/index.html');
  } else {
    res.redirect('/login');
  }
});

// Login page (serve login.html without auth)
app.get('/login', (req, res): void => {
  if (req.session.authenticated) {
    res.redirect('/index.html');
    return;
  }
  res.sendFile(path.join(__dirname, '..', 'public', 'login.html'));
});

// Auth routes (no auth middleware — login/logout/check must be public)
app.use(authRouter);

// Analytics API routes (protected)
app.use(requireAuthApi, analyticsRouter);

// Catch-all for unknown routes
app.use((_req, res): void => {
  res.status(404).json({ status: 'error', message: 'Not found' });
});

app.listen(PORT, () => {
  console.log(`[partner-web] Server running on http://localhost:${PORT}`);
});

export default app;
