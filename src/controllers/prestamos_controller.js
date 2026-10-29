import * as service from '../services/prestamos_services.js';

export const listar = async (req,res) =>{
    res.json(await service.listar());
};

export const prestar = async (req,res) =>{
    const prestamo = await service.prestar(req.body.libroId, req.body.usuarioId);
    res.status(201).json(prestamo);
};