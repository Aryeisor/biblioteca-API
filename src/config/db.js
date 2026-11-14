import pg from 'pg'
import { config } from './env.js';

const pool = new pg.Pool({
    host: config.db.host,
    port: config.db.port,
    user: config.db.user,
    password: config.db.password,
    database: config.db.name,
});

export default pool;
