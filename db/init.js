// Crea las tablas de db/schema.sql en la base de datos. Uso: npm run db:init
import 'dotenv/config'
import { readFile } from 'node:fs/promises'
import pool from '../src/config/db.js'

const schema = await readFile(new URL('./schema.sql', import.meta.url), 'utf8')

try {
    await pool.query(schema)
    console.log('tablas creadas')
} catch (error) {
    console.error('error al crear las tablas:', error.message)
    process.exitCode = 1
} finally {
    await pool.end()
}
