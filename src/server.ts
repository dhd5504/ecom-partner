import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import path from 'path';
import { requireAuth } from './auth';
import analyticsRouter from './routes/analytics';

const app = express();
const PORT = parseInt(process.env.PORT ?? '3001', 10);

// Body parsing
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Basic Auth — bảo vệ toàn bộ app (static files + API)
app.use(requireAuth);

// Static files (public/)
app.use(express.static(path.join(__dirname, '..', 'public')));

// Analytics API routes
app.use(analyticsRouter);

// Catch-all for unknown routes
app.use((_req, res): void => {
  res.status(404).json({ status: 'error', message: 'Not found' });
});

if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`[partner-web] Server running on http://localhost:${PORT}`);
  });
}

export default app;
