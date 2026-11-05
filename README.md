# Biblioteca API

API REST para gestionar una biblioteca: autores, libros, usuarios y préstamos. Hecha con Node.js, Express 5 y PostgreSQL.

## Tecnologías

Node.js · Express 5 · PostgreSQL · pg · bcryptjs · jsonwebtoken · ES Modules

## Requisitos

- Node.js 22 o superior
- PostgreSQL

## Instalación

1. Clonar el repositorio:

   ```bash
   git clone https://github.com/tu-usuario/biblioteca-API.git
   cd biblioteca-API
   ```

2. Instalar las dependencias:

   ```bash
   npm install
   ```

3. Copiar `.env.example` a `.env` y poner los datos de tu PostgreSQL:

   ```env
   PORT=3000

   DB_HOST=localhost
   DB_PORT=5432
   DB_USER=postgres
   DB_PASSWORD=tu_contraseña
   DB_NAME=biblioteca

   JWT_SECRET=cambia_esto_por_un_secreto_largo_y_aleatorio
   JWT_EXPIRES_IN=1h
   ```

   Para generar un `JWT_SECRET` seguro:

   ```bash
   node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
   ```

   Nunca subas el `.env` real al repositorio (contiene la contraseña de la BD y el secreto del JWT); solo se sube `.env.example`.

4. Crear la base de datos en PostgreSQL (desde psql o pgAdmin):

   ```sql
   CREATE DATABASE biblioteca;
   ```

5. Crear las tablas (ejecuta `db/schema.sql`):

   ```bash
   npm run db:init
   ```

   Basta con ejecutarlo una vez. Si se vuelve a correr no falla: el schema usa `CREATE TABLE IF NOT EXISTS` y `CREATE INDEX IF NOT EXISTS`, así que las tablas e índices que ya existen se omiten y los datos no se tocan. Ojo: por eso mismo, si cambias la definición de una tabla en `schema.sql`, volver a correr el script no la actualiza.

## Uso

```bash
npm run dev   # desarrollo, se reinicia al guardar cambios
npm start     # producción
```

La API queda en `http://localhost:3000`.

## Ejecución con Docker

Levanta la API y un PostgreSQL 17 en contenedores, sin instalar Node ni PostgreSQL en tu equipo.

Requisito: [Docker Desktop](https://www.docker.com/products/docker-desktop/).

1. Copiar `.env.example` a `.env` y completar los datos (el mismo archivo de la [instalación](#instalación)). Compose usa `DB_USER`, `DB_PASSWORD` y `DB_NAME` para crear la base del contenedor, y `JWT_SECRET`, `JWT_EXPIRES_IN` y `PORT` para la API.

2. Construir y levantar los contenedores:

   ```bash
   docker compose up --build
   ```

   La API queda en `http://localhost:3000`. Compose espera a que PostgreSQL esté listo (healthcheck con `pg_isready`) antes de arrancar la API.

- **El esquema se carga solo la primera vez.** `db/schema.sql` se ejecuta automáticamente al crear el volumen de datos (`pgdata`). Si después cambias `schema.sql`, no se vuelve a aplicar: hay que borrar el volumen con `docker compose down -v` (se pierden los datos).
- **La base del contenedor es independiente de tu PostgreSQL local.** Tienen datos distintos aunque se llamen igual. Compose fija `DB_HOST=db` (el nombre del servicio) y `DB_PORT=5432`, así que los valores de `DB_HOST` y `DB_PORT` de tu `.env` solo se usan al correr la API sin Docker.

| Comando                      | Qué hace                                                |
|------------------------------|---------------------------------------------------------|
| `docker compose up -d`       | Levanta los contenedores en segundo plano               |
| `docker compose logs -f api` | Muestra los logs de la API en vivo                      |
| `docker compose down`        | Detiene y elimina los contenedores (conserva los datos) |
| `docker compose down -v`     | Igual, pero también **borra el volumen con los datos**  |

No ejecutes `npm run dev` y Docker a la vez: los dos usan el puerto 3000 y el segundo en arrancar falla.

El puerto de PostgreSQL no se publica en el equipo: la API se conecta por la red interna de Compose. Si quieres conectarte a la base del contenedor con psql o DBeaver, agrega esto al servicio `db` en `docker-compose.yml` y conéctate a `localhost:5433` (se usa 5433 para no chocar con un PostgreSQL local en 5432):

```yaml
    ports:
      - "5433:5432"
```

## Pruebas

Los tests usan el test runner nativo de Node (`node:test` con `node:assert/strict`) y [Supertest](https://github.com/ladjs/supertest) para hacer peticiones HTTP a la app sin levantar el servidor. Corren contra una base de datos aparte, `biblioteca_test`, así que nunca tocan la base real `biblioteca`.

1. Copiar `.env.test.example` a `.env.test` y poner los datos de tu PostgreSQL:

   ```env
   PORT=3001
   DB_HOST=localhost
   DB_PORT=5432
   DB_USER=postgres
   DB_PASSWORD=tu_contraseña
   DB_NAME=biblioteca_test
   JWT_SECRET=secreto_de_prueba_solo_para_tests
   JWT_EXPIRES_IN=1h
   ```

   Igual que el `.env`, el `.env.test` real no se sube al repositorio.

2. Crear la base de prueba y sus tablas:

   ```bash
   npm run db:init:test
   ```

   Crea `biblioteca_test` si no existe y aplica `db/schema.sql`. Ojo: cada vez que se ejecuta **borra y recrea el esquema** de la base de prueba (así siempre refleja `schema.sql`), por lo que se pierden sus datos.

3. Ejecutar los tests:

   ```bash
   npm test
   ```

   Los archivos de `tests/` se ejecutan uno a uno (`--test-concurrency=1`) porque comparten la misma base; cada archivo vacía las tablas al empezar.

Como protección, tanto `npm run db:init:test` como los tests se niegan a correr si `DB_NAME` no termina en `_test`.

Actualmente hay **44 tests** que cubren:

- **Autenticación**: registro (email en minúsculas, sin password en la respuesta, email repetido, contraseña corta, email inválido), login correcto e incorrecto (mismo mensaje 401) y rutas protegidas sin token o con token inválido.
- **Autores**: validación del body.
- **Libros**: rutas públicas y protegidas, autor inexistente, stock negativo, ISBN repetido, `PATCH /libros/:id/stock` y filtro por título.
- **Usuarios**: todas las rutas requieren token, nunca se devuelve el password, y `PUT`/`DELETE` sobre otro usuario responden 403.
- **Préstamos**: el usuario se toma del token, el stock baja al prestar y sube al devolver, sin stock responde 409, un préstamo solo se puede devolver una vez (409 y el stock no vuelve a subir) y solo por su dueño (403).
- **Concurrencia**: con un libro de stock 1, dos préstamos simultáneos de usuarios distintos no pueden ocurrir a la vez: uno responde 201, el otro 409 y el stock queda en 0.
- **Peticiones sin body**: responden 400 en vez de 500.

## Autenticación

La API usa JWT. Las contraseñas se guardan como hash con bcrypt y nunca se devuelven en las respuestas.

### Auth — `/auth`

| Método | Ruta              | Descripción                      | Body |
|--------|-------------------|----------------------------------|------|
| POST   | `/auth/registrar` | Registra un usuario              | `{ "nombre": "Ana Pérez", "email": "ana@correo.com", "password": "unaClaveSegura" }` |
| POST   | `/auth/login`     | Inicia sesión y devuelve un token | `{ "email": "ana@correo.com", "password": "unaClaveSegura" }` |

- `POST /auth/registrar` responde `201` con el usuario creado, sin password (`id`, `nombre`, `email`, `created_at`). Reglas: `nombre` y `email` igual que en usuarios; `password` obligatorio, entre 8 y 72 caracteres (72 es el límite de bcrypt); email único (si se repite responde 409).
- `POST /auth/login` responde `200` con `{ "token": "..." }`. Si falta el email o la contraseña responde 400. Si el email no existe o la contraseña no coincide responde `401` con `{ "message": "Credenciales invalidas" }`: es el mismo mensaje en ambos casos a propósito, para no revelar qué emails están registrados.

### Cómo usar el token

Envía el token en el header de cada petición protegida:

```text
Authorization: Bearer <token>
```

En Insomnia: pestaña **Auth** → **Bearer Token** → pega el token en el campo *Token*.

El token expira según `JWT_EXPIRES_IN` (por ejemplo `1h`). Cuando expira, la API responde 401 y hay que volver a hacer login.

### Rutas protegidas

| Módulo     | Públicas (sin token)       | Protegidas (requieren token) |
|------------|----------------------------|------------------------------|
| Auth       | `POST /auth/registrar`, `POST /auth/login` | — |
| Autores    | `GET /autores`, `GET /autores/:id` | `POST`, `PUT`, `DELETE` |
| Libros     | `GET /libros`, `GET /libros/:id` | `POST`, `PUT`, `PATCH /libros/:id/stock`, `DELETE` |
| Usuarios   | —                          | Todas. `PUT` y `DELETE` solo sobre el propio usuario (403 si el `:id` no es el del token) |
| Préstamos  | —                          | Todas. `POST` toma el usuario del token; `PATCH /prestamos/:id/devolver` solo sobre préstamos propios (403 si es de otro usuario) |

Sin token responde `401 { "message": "Token requerido" }`; con un token inválido o expirado, `401 { "message": "Token inválido o expirado" }`.

## Endpoints

### Autores — `/autores`

| Método | Ruta               | Descripción              | Body                     |
|--------|--------------------|--------------------------|--------------------------|
| GET    | `/autores`     | Lista todos los autores  | —                        |
| GET    | `/autores/:id` | Obtiene un autor         | —                        |
| POST   | `/autores`     | Crea un autor            | `{ "nombre": "Gabriel García Márquez" }` |
| PUT    | `/autores/:id` | Actualiza un autor       | `{ "nombre": "..." }`    |
| DELETE | `/autores/:id` | Elimina un autor         | —                        |

Reglas: `nombre` obligatorio (máx. 100 caracteres).

### Libros — `/libros`

| Método | Ruta                    | Descripción                                   | Body |
|--------|-------------------------|-----------------------------------------------|------|
| GET    | `/libros`               | Lista todos los libros (con nombre del autor) | —    |
| GET    | `/libros?titulo=cien`   | Filtra por título (sin distinguir mayúsculas) | —    |
| GET    | `/libros/:id`           | Obtiene un libro                              | —    |
| POST   | `/libros`               | Crea un libro                                 | `{ "titulo": "Cien años de soledad", "isbn": "978-0307474728", "autorId": 1, "stock": 3 }` |
| PUT    | `/libros/:id`           | Actualiza un libro                            | Igual que POST |
| PATCH  | `/libros/:id/stock`     | Cambia solo el stock del libro                | `{ "stock": 5 }` |
| DELETE | `/libros/:id`           | Elimina un libro                              | —    |

Reglas: `titulo` obligatorio (máx. 200 caracteres); `isbn` opcional y único (máx. 20); `autorId` debe existir (si no, 404); `stock` entero ≥ 0, por defecto 0 (en el PATCH es obligatorio).

### Usuarios — `/usuarios`

| Método | Ruta             | Descripción              | Body |
|--------|------------------|--------------------------|------|
| GET    | `/usuarios`      | Lista todos los usuarios | —    |
| GET    | `/usuarios/:id`  | Obtiene un usuario       | —    |
| PUT    | `/usuarios/:id`  | Actualiza tu propio usuario | `{ "nombre": "Ana Pérez", "email": "ana@correo.com" }` |
| DELETE | `/usuarios/:id`  | Elimina tu propio usuario   | —    |

El alta de usuarios se hace con `POST /auth/registrar`. Todas las rutas requieren token; `PUT` y `DELETE` responden 403 (`Solo puedes modificar tu propio usuario`) si el `:id` no es el del usuario autenticado.

Reglas: `nombre` obligatorio (máx. 100 caracteres); `email` obligatorio, con formato válido, único (máx. 150) y se guarda en minúsculas.

### Préstamos — `/prestamos`

| Método | Ruta                       | Descripción                                        | Body |
|--------|----------------------------|----------------------------------------------------|------|
| GET    | `/prestamos`               | Lista todos los préstamos (con título y usuario)   | —    |
| GET    | `/prestamos?activos=true`  | Lista solo los préstamos no devueltos              | —    |
| GET    | `/prestamos/:id`           | Obtiene un préstamo                                | —    |
| POST   | `/prestamos`               | Presta un libro al usuario autenticado (descuenta 1 de stock) | `{ "libroId": 1 }` |
| PATCH  | `/prestamos/:id/devolver`  | Marca tu préstamo como devuelto (suma 1 al stock)  | —    |

Reglas: todas las rutas requieren token; el usuario del préstamo se toma del token, no del body. El libro y el usuario deben existir (si no, 404); si el libro no tiene stock responde 409; devolver un préstamo de otro usuario responde 403; devolver un préstamo ya devuelto responde 409. Prestar y devolver se hacen en una transacción (`BEGIN`/`COMMIT`, con `SELECT ... FOR UPDATE`), así el stock y el préstamo nunca quedan desincronizados aunque lleguen peticiones a la vez.

Ejemplo de respuesta de `POST /prestamos` (`201 Created`):

```json
{
  "id": 1,
  "fecha_prestamo": "2026-10-29T20:51:08.908Z",
  "fecha_devolucion": null,
  "libro_id": 3,
  "libro": "Don Quijote de la Mancha",
  "usuario_id": 1,
  "usuario": "Miguel Ángel"
}
```

`fecha_devolucion: null` significa que el préstamo sigue activo (el libro no se ha devuelto).

### Respuestas exitosas

| Código | Cuándo                                                  |
|--------|---------------------------------------------------------|
| 200    | Consultas (GET) y actualizaciones (PUT, PATCH, incluido `PATCH /prestamos/:id/devolver`) |
| 201    | Creación (POST), devuelve el registro creado            |
| 204    | Eliminación (DELETE), sin cuerpo en la respuesta        |

### Respuestas de error

Todos los errores responden con `{ "message": "..." }`:

| Código | Cuándo                                                        |
|--------|---------------------------------------------------------------|
| 400    | ID inválido o datos incorrectos (ej. nombre vacío, título de más de 200 caracteres o stock negativo) |
| 401    | Token ausente, inválido o expirado; o credenciales inválidas en el login |
| 403    | Acción sobre recursos de otro usuario (modificar/eliminar otro usuario o devolver un préstamo ajeno) |
| 404    | El registro o la ruta no existe                               |
| 409    | Valor duplicado (ej. ISBN o email repetido), se intenta borrar un registro relacionado (ej. un autor con libros), libro sin stock o préstamo ya devuelto |
| 500    | Error interno del servidor                                    |

## Base de datos

| Tabla       | Descripción                                                  |
|-------------|--------------------------------------------------------------|
| `autores`   | Autores de los libros                                        |
| `libros`    | Libros con ISBN único y stock; cada uno pertenece a un autor |
| `usuarios`  | Usuarios de la biblioteca, con email único y columna `password` (hash bcrypt, nunca se devuelve en las respuestas) |
| `prestamos` | Préstamos de libros a usuarios; `fecha_devolucion` vacía = no devuelto |

El esquema completo está en [db/schema.sql](db/schema.sql), que ya incluye la columna `password` en `usuarios`.

## Estructura del proyecto

```
db/
  schema.sql          # tablas e índices
  init.js             # script que ejecuta schema.sql
  init-test.js        # crea la base de prueba (DB_NAME de .env.test) y recrea sus tablas
src/
  server.js           # punto de entrada: conecta a la BD y levanta el servidor
  app.js              # configuración de Express y rutas
  config/db.js        # conexión (pool) a PostgreSQL
  routes/             # define las rutas
    auth.router.js, autores.router.js, libros.router.js, prestamos.router.js, usuarios.router.js
  controllers/        # traduce la petición HTTP a llamadas al service
    auth_controller.js, autores_controller.js, libros_controller.js, prestamos_controller.js, usuarios_controller.js
  services/           # reglas de negocio y validaciones
    auth_services.js, autores_services.js, libros_services.js, prestamos_services.js, usuarios_services.js
  repositories/       # consultas SQL
    autores_repositories.js, libros_repositories.js, prestamos_repositories.js, usuarios_repositories.js
  middlewares/        # verificación del token JWT y manejo de errores
    auth.js, errorHandler.js
tests/                # tests con node:test y Supertest contra la base de prueba
  helpers.js, auth.test.js, autores.test.js, libros.test.js, prestamos.test.js, usuarios.test.js
Dockerfile            # imagen de la API (node:22-alpine, solo dependencias de producción, usuario no root)
docker-compose.yml    # servicios api y db (PostgreSQL 17) con volumen de datos
.dockerignore         # archivos que no entran en la imagen (.env, node_modules, tests...)
```

## Próximos pasos

- [x] Autenticación con JWT y bcrypt
- [x] Tests con Supertest
- [x] Docker Compose para levantar la API y PostgreSQL
