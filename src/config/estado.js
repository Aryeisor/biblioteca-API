// src/config/estado.js
// Estado del proceso compartido entre server.js (lo cambia al apagar) y /health/ready (lo lee)
let apagando = false;

export const estaApagando = () => apagando;

// valor = false solo lo usan los tests para volver al estado inicial
export const marcarApagando = (valor = true) => {
    apagando = valor;
};
