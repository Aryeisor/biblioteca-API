// Tipos del dominio: la forma exacta de lo que devuelve cada consulta SQL.
//
// Los campos se llaman igual que las columnas (snake_case) porque así los devuelve la API:
// renombrarlos cambiaría el contrato con el frontend.
//
// Son "type" y no "interface" a propósito: los alias tienen una firma de índice implícita y por eso
// encajan en QueryResultRow, el tipo que exige pool.query<T>().

// Una sola fuente de verdad: la lista de roles genera el tipo Rol.
export const ROLES = ['lector', 'bibliotecario', 'admin'] as const;
export type Rol = (typeof ROLES)[number];

// Type guard: si devuelve true, TypeScript trata el valor como Rol a partir de ahí.
export const esRol = (valor: unknown): valor is Rol =>
    (ROLES as readonly unknown[]).includes(valor);

// Quién hace la petición (lo pone el middleware de autenticación a partir del JWT)
export type UsuarioAutenticado = { id: number; rol: Rol };

// RETURNING id
export type Id = { id: number };

// COUNT(*) OVER() es un bigint y pg devuelve los bigint como string.
export type FilaConTotal<T> = T & { total: string };

export type Autor = { id: number; nombre: string; created_at: Date };

export type Libro = {
    id: number;
    titulo: string;
    isbn: string | null; // la columna admite NULL
    stock: number;
    autor_id: number;
    autor: string; // nombre del autor (JOIN)
};
export type LibroBloqueado = { id: number; stock: number };
// DatosLibro (lo que el servicio ya validó y entrega al repositorio) ahora sale del esquema:
// ver src/schemas/libros.ts

// Usuario público: nunca incluye password
export type Usuario = { id: number; nombre: string; email: string; created_at: Date };
export type UsuarioConRol = Usuario & { rol: Rol };
// Solo para el login: trae el hash. password es null en usuarios antiguos sin contraseña.
export type UsuarioConCredenciales = {
    id: number;
    nombre: string;
    email: string;
    password: string | null;
    rol: Rol;
};

// Lo que lee la rotación de refresh tokens. Las fechas ya vienen comparadas por la base (booleanos).
export type FilaRefreshToken = {
    id: number;
    usuario_id: number;
    familia_id: string;
    vencido: boolean;
    revocado: boolean;
    usado: boolean;
    en_gracia: boolean; // se usó hace muy poco: probablemente una carrera legítima, no un robo
};

export type Prestamo = {
    id: number;
    fecha_prestamo: Date;
    fecha_devolucion: Date | null; // null = aún no devuelto
    libro_id: number;
    libro: string; // título (JOIN)
    usuario_id: number;
    usuario: string; // nombre (JOIN)
};
export type PrestamoBloqueado = {
    id: number;
    libro_id: number;
    usuario_id: number;
    fecha_devolucion: Date | null;
};
