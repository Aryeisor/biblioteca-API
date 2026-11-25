import { Router } from 'express';
import * as ctrl from '../controllers/auditoria_controller.js';
import auth from '../middlewares/auth.js';
import { authorize } from '../middlewares/authorize.js';

const router = Router();

// Solo admin: el registro muestra IPs y qué hizo cada usuario
router.get('/', auth, authorize('admin'), ctrl.listar);

export default router;
