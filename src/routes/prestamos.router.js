import { Router } from "express";
import * as ctrl from '../controllers/prestamos_controller.js';
import auth from "../middlewares/auth.js";


const router = Router();
router.use(auth);
router.get('/',ctrl.listar);
router.get('/:id', ctrl.obtener);
router.post('/', ctrl.prestar);
router.patch('/:id/devolver', ctrl.devolver);



export default router;