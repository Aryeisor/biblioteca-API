import * as service from '../services/auth_services.js';

export const registrar = async (req , res) => {
    const {nombre, email, password } = req.body ?? {}
    const usuario = await service.registrar(nombre,email,password);
    res.status(201).json(usuario);
} 

export const login = async(req,res) => {
    const {email,password} = req.body ?? {};
    res.json(await service.login(email,password));
};