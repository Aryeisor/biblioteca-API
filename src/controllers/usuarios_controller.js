import * as service from '../services/usuarios_services.js';

export const listar = async (req, res) => {
    res.json(await service.listar());
};

export const buscarPorId = async (req,res) => {
    res.json(await service.obtener(req.params.id));
};

export const crear = async (req,res) =>{
    const usuario = await service.crear(req.body.nombre, req.body.email);
    res.status(201).json(usuario);
};

export const actualizar = async(req,res) =>{
    res.json(await service.actualizar(req.params.id ,req.body.nombre, req.body.email));
};

export const eliminar = async (req,res) =>{
    await service.eliminar(req.params.id)
    res.status(204).send();
};