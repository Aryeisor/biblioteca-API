import express from 'express'
import autoresRoutes from './routes/autores.router.js';
import librosRoutes from './routes/libros.router.js';
import usuariosRoutes from './routes/usuarios.router.js';
import prestamosRoutes from './routes/prestamos.router.js';
import errorHandler from './middlewares/errorHandler.js';

const app = express();

app.use(express.json())

app.use('/autores', autoresRoutes);
app.use('/libros', librosRoutes);
app.use('/usuarios', usuariosRoutes);
app.use('/prestamos', prestamosRoutes);

app.use((req,res) =>  res.status(404).json({message: "Ruta no encontrada"}));
app.use(errorHandler);


export default app;
