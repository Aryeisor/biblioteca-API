import 'dotenv/config'
import app from './app.js'
import pool from './config/db.js'

const PORT = process.env.PORT

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
