import app from './app.js'
import pool from './config/db.js'
import { config } from './config/env.js'

const PORT = config.port;
//try catch para el manejo de la se conecto a la base de datos o no se pudo conectar
try {
    await pool.query('SELECT 1')
    console.log('conectado a la base de datos')
} catch (error) {
    console.error('no se pudo conectar a la base de datos:', error.message)
    process.exit(1)
}

app.listen(PORT, () =>{
    console.log(`escuchando en el puerto ${PORT}`)
});
