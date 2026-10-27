//Traduce HTTP a llamadas al service
//Express 5 pasa al errorHandler los errores de funciones async, por eso no hay try/catch

import * as service from '../services/autores_services.js';

export const listar = async (req, res) => {
    res.json(await service.listar());
};

export const obtener = async (req, res) => {
    res.json(await service.obtener(req.params.id));
};

export const crear = async (req, res) => {
    const autor = await service.crear(req.body?.nombre);
    res.status(201).json(autor);
};

export const actualizar = async (req, res) => {
    res.json(await service.actualizar(req.params.id, req.body?.nombre));
};

export const eliminar = async (req, res) => {
    await service.eliminar(req.params.id);
    res.status(204).send();
};
