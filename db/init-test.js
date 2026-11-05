// Crea la base de prueba (DB_NAME de .env.test) y sus tablas. Uso: npm run db:init:test
import { readFile } from 'node:fs/promises'
import pg from 'pg'

process.loadEnvFile('.env.test')

const { DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME } = process.env

// Protección: nunca tocar una base que no sea de prueba (p. ej. "biblioteca")
if (!DB_NAME?.endsWith('_test')) {
    console.error(`DB_NAME debe terminar en "_test" (valor actual: "${DB_NAME}")`)
    process.exit(1)
}
// CREATE DATABASE no admite parámetros: el nombre se interpola, así que se valida
if (!/^[A-Za-z0-9_]+$/.test(DB_NAME)) {
    console.error(`DB_NAME solo puede tener letras, números y guion bajo: "${DB_NAME}"`)
    process.exit(1)
}

const conexion = (database) => new pg.Client({
    host: DB_HOST, port: DB_PORT, user: DB_USER, password: DB_PASSWORD, database,
})

const admin = conexion('postgres')
try {
    await admin.connect()
    const { rowCount } = await admin.query('SELECT 1 FROM pg_database WHERE datname = $1', [DB_NAME])
    if (rowCount === 0) {
        await admin.query(`CREATE DATABASE "${DB_NAME}"`)
        console.log(`Base de datos ${DB_NAME} creada`)
    } else {
        console.log(`Base de datos ${DB_NAME} ya existe`)
    }
} catch (error) {
    console.error('error al crear la base de datos:', error.message)
    process.exitCode = 1
} finally {
    await admin.end()
}

if (!process.exitCode) {
    const schema = await readFile(new URL('./schema.sql', import.meta.url), 'utf8')
    const test = conexion(DB_NAME)
    try {
        await test.connect()
        // Recrea el esquema para que la base de prueba refleje siempre schema.sql (protegido por el chequeo _test)
        await test.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;')
        await test.query(schema)
        console.log('Tablas creadas')
    } catch (error) {
        console.error('error al crear las tablas:', error.message)
        process.exitCode = 1
    } finally {
        await test.end()
    }
}
