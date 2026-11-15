import { Router } from "express";
import * as ctrl from '../controllers/usuarios_controller.js';
import auth from '../middlewares/auth.js';
import { authorize } from "../middlewares/authorize.js";

const router = Router();

router.get('/', auth, authorize('bibliotecario', 'admin'),ctrl.listar);
router.get('/:id', auth, authorize('lector','bibliotecario', 'admin'),ctrl.buscarPorId);
router.put('/:id', auth, authorize('lector','bibliotecario', 'admin'),ctrl.actualizar);
router.delete('/:id', auth, authorize('lector', 'bibliotecario','admin'), ctrl.eliminar);
router.patch('/:id/rol', auth, authorize('admin'), ctrl.cambiarRol);

export default router;
