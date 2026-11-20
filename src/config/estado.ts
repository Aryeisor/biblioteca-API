// src/config/estado.ts
// Estado del proceso compartido entre server.js (lo cambia al apagar) y /health/ready (lo lee)
let apagando = false;

export const estaApagando = (): boolean => apagando;

// valor = false solo lo usan los tests para volver al estado inicial
export const marcarApagando = (valor = true): void => {
    apagando = valor;
};
