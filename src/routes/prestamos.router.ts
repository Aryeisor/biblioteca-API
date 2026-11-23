import { Router } from 'express';
import * as ctrl from '../controllers/prestamos_controller.js';
import auth from '../middlewares/auth.js';
import { authorize } from '../middlewares/authorize.js';

const router = Router();
router.use(auth);
router.get('/', authorize('lector', 'bibliotecario', 'admin'), ctrl.listar);
router.get('/:id', authorize('lector', 'bibliotecario', 'admin'), ctrl.obtener);
router.post('/', authorize('lector', 'bibliotecario', 'admin'), ctrl.prestar);
router.patch('/:id/devolver', authorize('bibliotecario', 'admin'), ctrl.devolver);

export default router;
