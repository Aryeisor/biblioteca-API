import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import * as repo from '../repositories/usuarios_repositories.js';
import {validarNombre, validarEmail} from './usuarios_services.js';

const validarPassword = (password) =>{
    
    if(typeof password !== 'string' || password.trim() === '' ){
        throw {status:400, message: "La contraseña es obligatoria"};
    };
   
    if(password.length < 8){
        throw {status: 400, message: "Debe contener minimo 8 caracteres"};
    };
    if(password.length > 72){
        throw {status: 400, message:"No puede superar el máximo de 72 caracteres"};
    };
    return password;
 
};

export const registrar = async (nombre, email, password) => {
  
  const nombreLimpio = validarNombre(nombre);
  const emailLimpio = validarEmail(email);
  const passwordValida = validarPassword(password);

  const hash = await bcrypt.hash(passwordValida, 10);
  
  return repo.crearConPassword(nombreLimpio,emailLimpio,hash);
  
};

export const login = async (email,password) => {
    // 1. validar que email y password lleguen como texto (400 si no)
    if ( typeof email !== 'string' || typeof password !== 'string' || password.trim() === '')
        throw {status : 400, message: "Email y contraseñas son obligatorios"};

    const emailLimpio = email.trim().toLocaleLowerCase();
    // 2. normalizar el email: trim + toLowerCase
    // 3. buscar el usuario por email
    const buscarUsuario = await repo.buscarPorEmail(emailLimpio);

    // 4. si no existe, o no tiene password (usuarios viejos) -> 401 "Credenciales inválidas"
    if(!buscarUsuario?.password){
        throw {status: 401, message:"Credenciales invalidas"};
    };
    // 5. bcrypt.compare(password, usuario.password) -> si es false, 401 "Credenciales inválidas"
    const ok = await bcrypt.compare(password,buscarUsuario.password);
    if(!ok){
        throw {status: 401, message:"Credenciales invalidas"};
    };

    const token = jwt.sign(
        { id: buscarUsuario.id },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN }
        );

    return { token };
}