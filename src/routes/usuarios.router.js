import { Router } from "express";
import * as ctrl from '../controllers/usuarios_controller.js';
import auth from '../middlewares/auth.js';

const router = Router();

router.get('/', auth, ctrl.listar);
router.get('/:id', auth, ctrl.buscarPorId);
router.put('/:id', auth, ctrl.actualizar);
router.delete('/:id', auth, ctrl.eliminar);

export default router;
