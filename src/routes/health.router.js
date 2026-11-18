import { Router } from 'express';
import pool from '../config/db.js';
import { estaApagando } from '../config/estado.js';

const router = Router();

// Liveness: si responde, el proceso está vivo. No toca la base a propósito.
router.get('/', (req, res) => res.json({ status: 'ok' }));

// Readiness: ¿puede atender peticiones ahora? (no se está apagando y la base responde)
router.get('/ready', async (req, res) => {
    // server.js lo pone en true al recibir SIGTERM/SIGINT: el balanceador deja de enviar tráfico
    if (estaApagando()) {
        return res.status(503).json({ code: 'APAGANDO', message: 'El servidor se está apagando' });
    }
    try {
        await pool.query('SELECT 1');
        res.json({ status: 'ok' });
    } catch (err) {
        // el detalle va al log; al cliente solo el code
        req.log.warn({ err }, 'readiness: la base de datos no responde');
        res.status(503).json({
            code: 'BD_NO_DISPONIBLE',
            message: 'La base de datos no está disponible',
        });
    }
});

export default router;
