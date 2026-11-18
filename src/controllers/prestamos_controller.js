import * as service from '../services/prestamos_services.js';

//req.query trae lo que va después del ? en la URL.
export const listar = async (req, res) => {
    const { activos, cursor, limite } = req.query;
    res.json(await service.listar({ activos, cursor, limite }, req.user));
};

export const prestar = async (req, res) => {
    const prestamo = await service.prestar(req.body?.libroId, req.body?.usuarioId, req.user);
    res.status(201).json(prestamo);
};

export const devolver = async (req, res) => {
    res.json(await service.devolver(req.params.id));
};

export const obtener = async (req, res) => {
    res.json(await service.obtener(req.params.id, req.user));
};
