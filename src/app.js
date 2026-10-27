import express from 'express'
import autoresRoutes from './routes/autores.router.js';
import errorHandler from './middlewares/errorHandler.js';

const app = express();

app.use(express.json())

app.use('/api/autores', autoresRoutes);

app.use((req,res) =>  res.status(404).json({message: "Ruta no encontrada"}));
app.use(errorHandler);


export default app;
