import { Router } from 'express';
import * as ctrl from '../controllers/auth_controller.js';

const router = Router();

router.post('/registrar', ctrl.registrar);

export default router;
