import bcrypt from "bcryptjs";
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