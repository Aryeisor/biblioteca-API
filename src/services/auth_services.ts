import bcrypt from 'bcryptjs';
import * as repo from '../repositories/usuarios_repositories.js';
import { iniciarSesion } from './sesiones_services.js';
import { auditar, huellaCorta } from './auditoria_services.js';
import type { ContextoAuditoria } from '../types/dominio.js';
import { AppError } from '../utils/AppError.js';
import { parsear } from '../schemas/comunes.js';
import { esquemaRegistro, esquemaLogin } from '../schemas/usuarios.js';

const COSTO_BCRYPT = 10;
// Se calcula una sola vez al cargar el módulo (top-level await). Mismo costo que los hashes reales,
// para que comparar contra él tarde lo mismo que contra un usuario que existe.
const HASH_FICTICIO = await bcrypt.hash('hash-ficticio-anti-enumeracion', COSTO_BCRYPT);

export const registrar = async (datos: unknown, contexto: ContextoAuditoria) => {
    const { nombre, email, password } = parsear(esquemaRegistro, datos);

    const hash = await bcrypt.hash(password, COSTO_BCRYPT);

    const usuario = await repo.crearConPassword(nombre, email, hash);
    await auditar({ accion: 'registro', actorId: usuario.id, objetivoId: usuario.id, contexto });
    return usuario;
};

export const login = async (datos: unknown, contexto: ContextoAuditoria) => {
    // 1-2. validar que email y password lleguen como texto (400 si no) y normalizar el email (trim + minúsculas)
    const { email, password } = parsear(esquemaLogin, datos);
    // 3. buscar el usuario por email
    const buscarUsuario = await repo.buscarPorEmail(email);

    // 4. si no existe -> 401 "Credenciales inválidas" (password es NOT NULL: todo usuario tiene hash)
    if (!buscarUsuario) {
        // comparar igual contra un hash ficticio: así este camino tarda lo mismo que una contraseña incorrecta
        await bcrypt.compare(password, HASH_FICTICIO);
        // se audita también aquí: así los dos fallos hacen el mismo trabajo y siguen tardando lo mismo
        await auditar({
            accion: 'login_fallido',
            detalle: { motivo: 'usuario_inexistente', email_huella: huellaCorta(email) },
            contexto,
        });
        throw new AppError(401, 'Credenciales invalidas');
    }
    // 5. bcrypt.compare(password, usuario.password) -> si es false, 401 "Credenciales inválidas"
    if (!buscarUsuario.password) {
        await bcrypt.compare(password, HASH_FICTICIO);
        throw new AppError(401, 'Credenciales invalidas');
    }
    const ok = await bcrypt.compare(password, buscarUsuario.password);
    if (!ok) {
        await auditar({
            accion: 'login_fallido',
            objetivoId: buscarUsuario.id,
            detalle: { motivo: 'password_incorrecta', email_huella: huellaCorta(email) },
            contexto,
        });
        throw new AppError(401, 'Credenciales invalidas');
    }

    // access token (corto, va en el body) + refresh token (largo, el controlador lo pone en una cookie)
    const { accessToken, refreshToken } = await iniciarSesion(buscarUsuario);
    await auditar({
        accion: 'login_exitoso',
        actorId: buscarUsuario.id,
        objetivoId: buscarUsuario.id,
        contexto,
    });
    return { token: accessToken, refreshToken };
};
