import * as service  from '../services/libros_services.js';

export const listar = async (req,res) => {
    res.json(await service.listar(req.query.titulo));
};

export const obtenerPorId = async (req,res) => {
    res.json( await service.obtener(req.params.id));
};

export const crear = async (req,res) =>{
    const libro = await service.crear(req.body);
    res.status(201).json(libro);
};

export const actualizar = async (req,res) =>{
    res.json( await service.actualizar(req.params.id , req.body));
};

export const eliminar = async (req,res) => {
    await service.eliminar(req.params.id);
    res.status(204).send();
};