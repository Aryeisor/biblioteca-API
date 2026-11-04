import {Router} from 'express';
import * as ctrl from '../controllers/autores_controller.js';
import auth from '../middlewares/auth.js';

const router = Router();

router.get('/', ctrl.listar);
router.get('/:id', ctrl.obtener);
router.post('/', auth, ctrl.crear);
router.put('/:id', auth, ctrl.actualizar);
router.delete('/:id', auth, ctrl.eliminar);

export default router;