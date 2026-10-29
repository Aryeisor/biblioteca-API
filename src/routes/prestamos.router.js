import { Router } from "express";
import * as ctrl from '../controllers/prestamos_controller.js';


const router = Router();

router.get('/',ctrl.listar)
router.post('/', ctrl.prestar);

export default router;