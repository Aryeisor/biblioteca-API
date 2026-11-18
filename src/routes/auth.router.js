import { Router } from 'express';
import { rateLimit } from '../middlewares/rateLimit.js';
import * as ctrl from '../controllers/auth_controller.js';

const router = Router();

const limitePorIp = rateLimit({
    ventanaMs: 15 * 60 * 1000,
    max: 20,
    clave: (req) => req.ip,
    code: 'DEMASIADAS_PETICIONES',
});
const limitePorEmail = rateLimit({
    ventanaMs: 15 * 60 * 1000,
    max: 5,
    clave: (req) =>
        String(req.body?.email ?? '')
            .trim()
            .toLowerCase(),
    code: 'DEMASIADOS_INTENTOS',
});
// contador propio: registrarse no gasta intentos de login
const limiteRegistroPorIp = rateLimit({
    ventanaMs: 60 * 60 * 1000,
    max: 10,
    clave: (req) => req.ip,
    code: 'DEMASIADOS_REGISTROS',
});

router.post('/login', limitePorIp, limitePorEmail, ctrl.login);
router.post('/registrar', limiteRegistroPorIp, ctrl.registrar);

export default router;
