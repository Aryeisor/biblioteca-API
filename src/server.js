import app from './app.js'
import pool from './config/db.js'
import { config } from './config/env.js'
import { logger } from './config/logger.js'

const PORT = config.port;
//try catch para el manejo de la se conecto a la base de datos o no se pudo conectar
try {
    await pool.query('SELECT 1')
    logger.info('conectado a la base de datos')
} catch (error) {
    logger.fatal({ err: error }, 'no se pudo conectar a la base de datos')
    process.exit(1)
}

app.listen(PORT, () =>{
    logger.info(`escuchando en el puerto ${PORT}`)
});
