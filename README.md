# Biblioteca API

API REST para gestionar una biblioteca: autores, libros, usuarios y préstamos. Hecha con Node.js, Express 5 y PostgreSQL.

## Requisitos

- Node.js 22 o superior
- PostgreSQL

## Instalación

1. Instalar las dependencias:

   ```bash
   npm install
   ```

2. Copiar `.env.example` a `.env` y poner los datos de tu PostgreSQL:

   ```env
   PORT=3000

   DB_HOST=localhost
   DB_PORT=5432
   DB_USER=postgres
   DB_PASSWORD=tu_contraseña
   DB_NAME=biblioteca
   ```

3. Crear la base de datos en PostgreSQL (desde psql o pgAdmin):

   ```sql
   CREATE DATABASE biblioteca;
   ```

4. Crear las tablas (ejecuta `db/schema.sql`; solo se corre una vez):

   ```bash
   npm run db:init
   ```

## Uso

```bash
npm run dev   # desarrollo, se reinicia al guardar cambios
npm start     # producción
```

La API queda en `http://localhost:3000`.

## Endpoints

### Autores — `/autores`

| Método | Ruta               | Descripción              | Body                     |
|--------|--------------------|--------------------------|--------------------------|
| GET    | `/autores`     | Lista todos los autores  | —                        |
| GET    | `/autores/:id` | Obtiene un autor         | —                        |
| POST   | `/autores`     | Crea un autor            | `{ "nombre": "Gabriel García Márquez" }` |
| PUT    | `/autores/:id` | Actualiza un autor       | `{ "nombre": "..." }`    |
| DELETE | `/autores/:id` | Elimina un autor         | —                        |

### Libros — `/libros`

| Método | Ruta                    | Descripción                                   | Body |
|--------|-------------------------|-----------------------------------------------|------|
| GET    | `/libros`               | Lista todos los libros (con nombre del autor) | —    |
| GET    | `/libros?titulo=cien`   | Filtra por título (sin distinguir mayúsculas) | —    |
| GET    | `/libros/:id`           | Obtiene un libro                              | —    |
| POST   | `/libros`               | Crea un libro                                 | `{ "titulo": "Cien años de soledad", "isbn": "978-0307474728", "autorId": 1, "stock": 3 }` |
| PUT    | `/libros/:id`           | Actualiza un libro                            | Igual que POST |
| DELETE | `/libros/:id`           | Elimina un libro                              | —    |

Reglas: `titulo` obligatorio (máx. 200 caracteres); `isbn` opcional y único (máx. 20); `autorId` debe existir (si no, 404); `stock` entero ≥ 0, por defecto 0.

### Usuarios — `/usuarios`

| Método | Ruta             | Descripción              | Body |
|--------|------------------|--------------------------|------|
| GET    | `/usuarios`      | Lista todos los usuarios | —    |
| GET    | `/usuarios/:id`  | Obtiene un usuario       | —    |
| POST   | `/usuarios`      | Crea un usuario          | `{ "nombre": "Ana Pérez", "email": "ana@correo.com" }` |
| PUT    | `/usuarios/:id`  | Actualiza un usuario     | Igual que POST |
| DELETE | `/usuarios/:id`  | Elimina un usuario       | —    |

Reglas: `nombre` obligatorio (máx. 100 caracteres); `email` obligatorio, con formato válido, único (máx. 150) y se guarda en minúsculas.

### Respuestas de error

Todos los errores responden con `{ "message": "..." }`:

| Código | Cuándo                                                        |
|--------|---------------------------------------------------------------|
| 400    | ID inválido o datos incorrectos (ej. nombre vacío, título de más de 200 caracteres o stock negativo) |
| 404    | El registro o la ruta no existe                               |
| 409    | Valor duplicado (ej. ISBN o email repetido), o se intenta borrar un registro relacionado (ej. un autor con libros) |
| 500    | Error interno del servidor                                    |

## Base de datos

| Tabla       | Descripción                                                  |
|-------------|--------------------------------------------------------------|
| `autores`   | Autores de los libros                                        |
| `libros`    | Libros con ISBN único y stock; cada uno pertenece a un autor |
| `usuarios`  | Usuarios de la biblioteca, con email único                   |
| `prestamos` | Préstamos de libros a usuarios; `fecha_devolucion` vacía = no devuelto |

El esquema completo está en [db/schema.sql](db/schema.sql).

## Estructura del proyecto

```
db/
  schema.sql          # tablas e índices
  init.js             # script que ejecuta schema.sql
src/
  server.js           # punto de entrada: conecta a la BD y levanta el servidor
  app.js              # configuración de Express y rutas
  config/db.js        # conexión (pool) a PostgreSQL
  routes/             # define las rutas
  controllers/        # traduce la petición HTTP a llamadas al service
  services/           # reglas de negocio y validaciones
  repositories/       # consultas SQL
  middlewares/        # manejo de errores
```
