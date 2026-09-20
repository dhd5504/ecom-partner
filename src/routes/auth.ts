import { Router } from 'express';

// Auth routes không còn cần thiết khi dùng HTTP Basic Auth.
// File này được giữ lại để tránh lỗi import nếu có, nhưng không export route nào cả.
const router = Router();

export default router;
