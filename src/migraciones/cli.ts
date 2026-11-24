// Uso (desde npm):
//   npm run db:migrar                      aplica las migraciones pendientes
//   npm run db:estado                      muestra cuáles están aplicadas y cuáles pendientes
//   npm run db:migrar -- baseline 003      anota como aplicadas hasta la 003 en una base ya existente
//
// No importa src/config/env.ts a propósito: ese módulo exige JWT_SECRET y demás variables de la API,
// y migrar solo necesita los datos de la base.
import 'dotenv/config';
import pg from 'pg';
import { aplicarMigraciones, estadoMigraciones, marcarComoAplicadas } from './ejecutor.js';

const AYUDA = 'Uso: migrar [estado | baseline <version>]';

const variable = (nombre: string): string => {
    const valor = process.env[nombre];
    if (!valor) throw new Error(`Falta la variable de entorno ${nombre}`);
    return valor;
};

const main = async (): Promise<void> => {
    const [comando = 'migrar', argumento] = process.argv.slice(2);

    const client = new pg.Client({
        host: variable('DB_HOST'),
        port: Number(variable('DB_PORT')),
        user: variable('DB_USER'),
        password: variable('DB_PASSWORD'),
        database: variable('DB_NAME'),
    });
    await client.connect();

    try {
        if (comando === 'migrar') {
            const aplicadas = await aplicarMigraciones(client, undefined, console.log);
            console.log(
                aplicadas.length === 0
                    ? 'La base ya está al día'
                    : `Listo: ${aplicadas.length} migración(es) aplicada(s)`,
            );
        } else if (comando === 'estado') {
            for (const m of await estadoMigraciones(client)) {
                const cuando = m.aplicadaEn ? ` (${m.aplicadaEn.toISOString()})` : '';
                console.log(`${m.estado.padEnd(9)} ${m.version}_${m.nombre}${cuando}`);
            }
        } else if (comando === 'baseline' && argumento) {
            const marcadas = await marcarComoAplicadas(client, argumento);
            console.log(`Marcadas como aplicadas (sin ejecutarlas): ${marcadas.join(', ')}`);
        } else {
            console.error(AYUDA);
            process.exitCode = 1;
        }
    } finally {
        await client.end();
    }
};

main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
});
