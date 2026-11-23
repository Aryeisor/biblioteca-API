import { Router } from 'express';
import * as ctrl from '../controllers/libros_controller.js';
import auth from '../middlewares/auth.js';
import { authorize } from '../middlewares/authorize.js';

const router = Router();

router.get('/', ctrl.listar);
router.get('/:id', ctrl.obtenerPorId);
router.post('/', auth, authorize('bibliotecario', 'admin'), ctrl.crear);
router.put('/:id', auth, authorize('bibliotecario', 'admin'), ctrl.actualizar);
router.patch('/:id/stock', auth, authorize('bibliotecario', 'admin'), ctrl.actualizarStock);
router.delete('/:id', auth, authorize('admin'), ctrl.eliminar);

export default router;
