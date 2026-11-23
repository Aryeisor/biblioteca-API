import { esquemaPagina, parsear } from '../schemas/comunes.js';

// COUNT(*) OVER() es un bigint y pg devuelve los bigint como string: por eso string | number.
interface ConTotal {
    total: string | number;
}

export interface ParametrosPagina {
    pagina?: unknown;
    limite?: unknown;
}

export interface Paginado<T> {
    data: T[];
    paginacion: {
        pagina: number;
        limite: number;
        total: number;
        totalPaginas: number;
    };
}

// Paginación por offset en un solo lugar: validar, calcular el offset, leer el total y armar la respuesta.
// consultar(limite, offset) debe devolver filas con una columna `total` (COUNT(*) OVER()).
//
// Genérico: T es el tipo de fila que devuelve `consultar` (Libro, Usuario...). `extends ConTotal`
// exige que tenga `total`, y el resultado es ese mismo tipo SIN `total` (Omit<T, 'total'>).
export const paginarOffset = async <T extends ConTotal>(
    { pagina, limite }: ParametrosPagina,
    consultar: (limite: number, offset: number) => Promise<T[]>,
): Promise<Paginado<Omit<T, 'total'>>> => {
    // El esquema valida, convierte a número y aplica los valores por defecto (pagina 1, limite 20)
    const { pagina: paginaNum, limite: limiteNum } = parsear(esquemaPagina, { pagina, limite });
    const offset = (paginaNum - 1) * limiteNum;

    const filas = await consultar(limiteNum, offset);

    // Con noUncheckedIndexedAccess, filas[0] es "T | undefined": hay que comprobar que exista.
    // Página vacía: el total viaja dentro de las filas, así que si no hay filas hay que pedirlo aparte.
    const primeraFila = filas[0];
    let total = primeraFila ? Number(primeraFila.total) : 0;
    if (!primeraFila && offset > 0) {
        const [primera] = await consultar(1, 0);
        total = primera ? Number(primera.total) : 0;
    }

    return {
        data: filas.map(({ total, ...fila }) => fila),
        paginacion: {
            pagina: paginaNum,
            limite: limiteNum,
            total,
            totalPaginas: Math.ceil(total / limiteNum),
        },
    };
};
