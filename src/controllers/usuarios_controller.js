import * as service from '../services/usuarios_services.js';

export const listar = async (req, res) => {
    const { pagina, limite } = req.query;
    res.json(await service.listar({ pagina, limite }));
};

export const buscarPorId = async (req, res) => {
    res.json(await service.obtener(req.params.id, req.user));
};

export const actualizar = async (req, res) => {
    res.json(await service.actualizar(req.params.id, req.body?.nombre, req.body?.email, req.user));
};

export const eliminar = async (req, res) => {
    await service.eliminar(req.params.id, req.user);
    res.status(204).send();
};

export const cambiarRol = async (req, res) => {
    res.json(await service.cambiarRol(req.params.id, req.body?.rol, req.user));
};
