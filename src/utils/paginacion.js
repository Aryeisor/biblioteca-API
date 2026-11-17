import { validarEntero } from './validators.js';

// Paginación por offset en un solo lugar: validar, calcular el offset, leer el total y armar la respuesta.
// consultar(limite, offset) debe devolver filas con una columna `total` (COUNT(*) OVER()).
export const paginarOffset = async ({ pagina, limite }, consultar) => {
  const paginaNum = validarEntero(pagina, 'pagina', 1, Number.MAX_SAFE_INTEGER, 1);
  const limiteNum = validarEntero(limite, 'limite', 1, 100, 20); // 400 en vez de recortar: el cliente se entera del error
  const offset = (paginaNum - 1) * limiteNum;

  const filas = await consultar(limiteNum, offset);

  // Página vacía: el total viaja dentro de las filas, así que si no hay filas hay que pedirlo aparte.
  let total = filas.length ? Number(filas[0].total) : 0;
  if (!filas.length && offset > 0) {
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
