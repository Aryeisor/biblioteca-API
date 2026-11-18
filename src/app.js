import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import autoresRoutes from './routes/autores.router.js';
import librosRoutes from './routes/libros.router.js';
import usuariosRoutes from './routes/usuarios.router.js';
import prestamosRoutes from './routes/prestamos.router.js';
import authRoutes from './routes/auth.router.js';
import errorHandler from './middlewares/errorHandler.js';
import { config } from './config/env.js';

const app = express();

// Nunca 'true': le creería a cualquier X-Forwarded-For que invente el cliente
app.set('trust proxy', config.trustProxy);


app.use(helmet());
app.use(cors({origin: config.corsOrigins}));
app.use(express.json({limit: '100kb'}));

app.use('/autores', autoresRoutes);
app.use('/libros', librosRoutes);
app.use('/usuarios', usuariosRoutes);
app.use('/prestamos', prestamosRoutes);
app.use('/auth', authRoutes);

app.use((req,res) =>  res.status(404).json({message: "Ruta no encontrada"}));
app.use(errorHandler);


export default app;
