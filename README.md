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

   # Proxies tuyos delante de la app: 0 en local, 1 detrás de Nginx/balanceador
   TRUST_PROXY=0

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

   Al arrancar, `src/config/env.js` valida la configuración y la app se detiene con un mensaje claro si algo está mal:

   - Todas las variables de arriba son obligatorias, salvo `TRUST_PROXY`; si falta alguna, indica cuáles.
   - `PORT` y `DB_PORT` deben ser enteros entre 1 y 65535.
   - `JWT_SECRET` debe tener al menos 32 caracteres.
   - `TRUST_PROXY` es opcional (por defecto `0`) y debe ser un entero ≥ 0. Ver [IP real detrás de un proxy](#ip-real-detrás-de-un-proxy-trust_proxy).

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

Supertest hace todas las peticiones desde la misma IP, así que los tests chocarían con el [rate limiting](#rate-limiting). En vez de desactivarlo, `tests/helpers.js` llama a `reiniciarLimites()` en un `beforeEach`: cada test empieza con los contadores en 0 y se prueba con los límites reales.

Actualmente hay **67 tests** que cubren:

- **Autenticación**: registro (email en minúsculas, sin password en la respuesta, email repetido, contraseña corta, email inválido), login correcto e incorrecto (mismo mensaje 401), rutas protegidas sin token o con token inválido, token vencido (`TOKEN_EXPIRADO`) y token con la firma alterada (`TOKEN_INVALIDO`).
- **Rate limiting**: el 6.º intento con el mismo email (aunque cambien mayúsculas o espacios) da 429 con `Retry-After`, bloquear un email no afecta a otro, el límite por IP, y un `X-Forwarded-For` inventado no esquiva el límite.
- **Autores**: validación del body.
- **Libros**: rutas públicas y protegidas, autor inexistente, stock negativo, ISBN repetido, JSON mal formado (400), `PATCH /libros/:id/stock`, filtro por título y paginación (páginas distintas, total con filtro, límite inválido y página fuera de rango).
- **Usuarios**: todas las rutas requieren token, nunca se devuelve el password, y `PUT`/`DELETE` sobre otro usuario responden 403; paginación por offset (páginas distintas, página fuera de rango con el total real y parámetros inválidos).
- **Préstamos**: el usuario se toma del token, el stock baja al prestar y sube al devolver, sin stock responde 409, un préstamo solo se puede devolver una vez (409 y el stock no vuelve a subir) y solo por su dueño (403); paginación con cursor (recorrer todas las páginas sin repetidos ni faltantes, combinada con `activos=true` y con el filtro del lector, cursor inválido).
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
- `POST /auth/login` responde `200` con `{ "token": "..." }`. Si falta el email o la contraseña responde 400. Si el email no existe o la contraseña no coincide responde `401` con `{ "message": "Credenciales invalidas" }`: es el mismo mensaje en ambos casos a propósito, para no revelar qué emails están registrados. Por la misma razón, ambos casos **tardan lo mismo**: si el email no existe, se ejecuta igual un `bcrypt.compare` contra un hash ficticio (calculado una sola vez al cargar el módulo, con el mismo costo que los hashes reales). Sin esto, la respuesta rápida delataría qué emails no existen.

### Rate limiting

Las rutas de `/auth` tienen límite de intentos para frenar la fuerza bruta ([src/middlewares/rateLimit.js](src/middlewares/rateLimit.js), ventana fija):

| Ruta                   | Clave                          | Límite         | `code` al superarlo     |
|------------------------|--------------------------------|----------------|-------------------------|
| `POST /auth/login`     | IP                             | 20 cada 15 min | `DEMASIADAS_PETICIONES` |
| `POST /auth/login`     | email (sin espacios y en minúsculas) | 5 cada 15 min  | `DEMASIADOS_INTENTOS`   |
| `POST /auth/registrar` | IP                             | 10 cada hora   | `DEMASIADOS_REGISTROS`  |

Al superar el límite responde `429` con el header `Retry-After` (segundos que faltan para que se reinicie la ventana). Un proceso periódico borra los contadores vencidos para que la memoria no crezca sin límite.

Limitación: los contadores viven en la memoria del proceso. Se pierden al reiniciar la API y no se comparten entre varias instancias (con 3 instancias detrás de un balanceador, el límite real se triplica). Para eso habría que guardarlos en Redis.

### IP real detrás de un proxy (`TRUST_PROXY`)

El límite por IP usa `req.ip`. Detrás de un Nginx o balanceador, todas las peticiones llegarían con la IP del proxy y todos los usuarios compartirían el mismo contador. `app.set('trust proxy', config.trustProxy)` le dice a Express cuántos proxies debe creer al leer `X-Forwarded-For`:

- `0` (por defecto): sin proxy, como en local. Ignora `X-Forwarded-For`.
- `1`: detrás de un Nginx o balanceador que tú controlas.
- Nunca `true`: Express le creería a cualquier `X-Forwarded-For`, incluso al que inventa el cliente, y el límite por IP dejaría de servir.

### Cómo usar el token

Envía el token en el header de cada petición protegida:

```text
Authorization: Bearer <token>
```

En Insomnia: pestaña **Auth** → **Bearer Token** → pega el token en el campo *Token*.

El token se firma y se verifica solo con el algoritmo `HS256` (se rechaza cualquier token firmado con otro algoritmo). Expira según `JWT_EXPIRES_IN` (por ejemplo `1h`); cuando expira, la API responde 401 con el código `TOKEN_EXPIRADO` y hay que volver a hacer login.

### Rutas protegidas

| Módulo     | Públicas (sin token)       | Protegidas (requieren token) |
|------------|----------------------------|------------------------------|
| Auth       | `POST /auth/registrar`, `POST /auth/login` | — |
| Autores    | `GET /autores`, `GET /autores/:id` | `POST`, `PUT`, `DELETE` |
| Libros     | `GET /libros`, `GET /libros/:id` | `POST`, `PUT`, `PATCH /libros/:id/stock`, `DELETE` |
| Usuarios   | —                          | Todas. `PUT` y `DELETE` solo sobre el propio usuario (403 si el `:id` no es el del token) |
| Préstamos  | —                          | Todas. `POST` toma el usuario del token; `PATCH /prestamos/:id/devolver` solo sobre préstamos propios (403 si es de otro usuario) |

Errores de token (todos con estado `401`):

| Caso                            | Respuesta |
|---------------------------------|-----------|
| Sin header `Authorization`      | `{ "code": "TOKEN_REQUERIDO", "message": "Token requerido" }` |
| Token expirado                  | `{ "code": "TOKEN_EXPIRADO", "message": "El token expiró" }` |
| Token mal formado, firma alterada u otro algoritmo | `{ "code": "TOKEN_INVALIDO", "message": "Token inválido" }` |

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
| GET    | `/libros`               | Lista los libros paginados (con nombre del autor) | —    |
| GET    | `/libros?titulo=cien`   | Filtra por título (sin distinguir mayúsculas) | —    |
| GET    | `/libros?pagina=2&limite=10` | Página concreta (se combina con `titulo`) | —    |
| GET    | `/libros/:id`           | Obtiene un libro                              | —    |
| POST   | `/libros`               | Crea un libro                                 | `{ "titulo": "Cien años de soledad", "isbn": "978-0307474728", "autorId": 1, "stock": 3 }` |
| PUT    | `/libros/:id`           | Actualiza un libro                            | Igual que POST |
| PATCH  | `/libros/:id/stock`     | Cambia solo el stock del libro                | `{ "stock": 5 }` |
| DELETE | `/libros/:id`           | Elimina un libro                              | —    |

Reglas: `titulo` obligatorio (máx. 200 caracteres); `isbn` opcional y único (máx. 20); `autorId` debe existir (si no, 404); `stock` entero ≥ 0, por defecto 0 (en el PATCH es obligatorio).

#### Paginación de `GET /libros`

| Parámetro | Tipo | Por defecto | Reglas |
|-----------|------|-------------|--------|
| `pagina`  | entero | `1`  | ≥ 1 |
| `limite`  | entero | `20` | entre 1 y 100 |

Un valor fuera de rango o que no sea entero (ej. `limite=5000`, `pagina=abc`) responde **400**; no se recorta en silencio, para que el cliente sepa que pidió algo inválido.

La respuesta es un objeto con los datos de la página y la información para navegar:

```json
{
  "data": [
    { "id": 1, "titulo": "Cien años de soledad", "isbn": "111", "stock": 3, "autor_id": 1, "autor": "Gabriel García Márquez" }
  ],
  "paginacion": { "pagina": 1, "limite": 20, "total": 13, "totalPaginas": 1 }
}
```

- `total` cuenta los libros que cumplen el filtro `titulo`, no solo los de la página.
- Pedir una página que no existe (ej. `pagina=99`) responde 200 con `data: []` y el `total` real.

### Usuarios — `/usuarios`

| Método | Ruta             | Descripción              | Body |
|--------|------------------|--------------------------|------|
| GET    | `/usuarios`      | Lista los usuarios paginados (`?pagina=2&limite=10`) | —    |
| GET    | `/usuarios/:id`  | Obtiene un usuario       | —    |
| PUT    | `/usuarios/:id`  | Actualiza tu propio usuario | `{ "nombre": "Ana Pérez", "email": "ana@correo.com" }` |
| DELETE | `/usuarios/:id`  | Elimina tu propio usuario   | —    |

El alta de usuarios se hace con `POST /auth/registrar`. Todas las rutas requieren token; `PUT` y `DELETE` responden 403 (`Solo puedes modificar tu propio usuario`) si el `:id` no es el del usuario autenticado.

Reglas: `nombre` obligatorio (máx. 100 caracteres); `email` obligatorio, con formato válido, único (máx. 150) y se guarda en minúsculas.

`GET /usuarios` se pagina por offset igual que `GET /libros`: mismos parámetros (`pagina`, `limite`), mismas reglas y misma respuesta `{ data, paginacion }` (ver [paginación de libros](#paginación-de-get-libros)). Ordena por `id`.

### Préstamos — `/prestamos`

| Método | Ruta                       | Descripción                                        | Body |
|--------|----------------------------|----------------------------------------------------|------|
| GET    | `/prestamos`               | Lista los préstamos paginados, del más reciente al más viejo (con título y usuario) | —    |
| GET    | `/prestamos?activos=true`  | Lista solo los préstamos no devueltos              | —    |
| GET    | `/prestamos?cursor=...&limite=10` | Página siguiente (se combina con `activos`) | —    |
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

#### Paginación de `GET /prestamos` (cursor)

El historial de préstamos crece todos los días, así que se pagina con **cursor** en vez de `pagina`: cada respuesta dice dónde seguir y los préstamos nuevos no desplazan las páginas que ya se leyeron.

| Parámetro | Tipo | Por defecto | Reglas |
|-----------|------|-------------|--------|
| `limite`  | entero | `20` | entre 1 y 100; si no, **400** |
| `cursor`  | texto  | — (primera página) | el `siguienteCursor` de la respuesta anterior; si no es válido, **400** con `code: "CURSOR_INVALIDO"` |

```json
{
  "data": [
    { "id": 42, "fecha_prestamo": "2026-11-17T15:02:11.000Z", "fecha_devolucion": null, "libro_id": 3, "libro": "Ficciones", "usuario_id": 1, "usuario": "Ana" }
  ],
  "paginacion": { "limite": 20, "siguienteCursor": "eyJpZCI6NDJ9" }
}
```

- Para la página siguiente se repite la misma petición (con los mismos filtros) agregando `cursor=<siguienteCursor>`. Cuando `siguienteCursor` es `null`, no hay más páginas.
- El cursor es **opaco**: hay que usarlo tal cual, sin construirlo ni interpretarlo. Su contenido puede cambiar (por ejemplo, si el orden pasa a ser por fecha).
- No hay `total` ni `totalPaginas`: contar todo el historial en cada petición sería caro, y un historial no se navega saltando a "la página 7".
- Un lector solo pagina sus propios préstamos; el filtro por usuario se aplica junto con el cursor.

### Respuestas exitosas

| Código | Cuándo                                                  |
|--------|---------------------------------------------------------|
| 200    | Consultas (GET) y actualizaciones (PUT, PATCH, incluido `PATCH /prestamos/:id/devolver`) |
| 201    | Creación (POST), devuelve el registro creado            |
| 204    | Eliminación (DELETE), sin cuerpo en la respuesta        |

### Respuestas de error

Todos los errores responden con `{ "message": "..." }`, y algunos incluyen además un `code` estable para que el frontend no dependa del texto del mensaje:

```json
{ "code": "TOKEN_EXPIRADO", "message": "El token expiró" }
```

| Código | Cuándo                                                        |
|--------|---------------------------------------------------------------|
| 400    | ID inválido, datos incorrectos (ej. nombre vacío, título de más de 200 caracteres o stock negativo) o cuerpo que no es un JSON válido |
| 401    | Token ausente, inválido o expirado; o credenciales inválidas en el login |
| 403    | Acción sobre recursos de otro usuario (modificar/eliminar otro usuario o devolver un préstamo ajeno) |
| 404    | El registro o la ruta no existe                               |
| 409    | Valor duplicado (ej. ISBN o email repetido), se intenta borrar un registro relacionado (ej. un autor con libros), libro sin stock o préstamo ya devuelto |
| 429    | Demasiados intentos en `/auth` (ver [rate limiting](#rate-limiting)); incluye el header `Retry-After` |
| 500    | Error interno del servidor                                    |

Valores de `code`:

| `code`                 | Estado | Cuándo |
|------------------------|--------|--------|
| `TOKEN_REQUERIDO`      | 401    | No se envió el token |
| `TOKEN_EXPIRADO`       | 401    | El token venció |
| `TOKEN_INVALIDO`       | 401    | El token es inválido |
| `JSON_INVALIDO`        | 400    | El cuerpo de la petición no es un JSON válido |
| `CURSOR_INVALIDO`      | 400    | El `cursor` de `GET /prestamos` no es válido (no salió de una respuesta de la API) |
| `PETICION_INVALIDA`    | 4xx    | Otros errores de la petición detectados por Express (ej. cuerpo demasiado grande) |
| `REGISTRO_DUPLICADO`   | 409    | Valor único repetido (ISBN, email) |
| `PRESTAMO_DUPLICADO`   | 409    | El usuario ya tiene un préstamo activo de ese libro |
| `REGISTRO_RELACIONADO` | 409    | El registro está relacionado con otros datos (ej. borrar un autor con libros) |
| `DEMASIADAS_PETICIONES`| 429    | Más de 20 logins desde la misma IP en 15 min |
| `DEMASIADOS_INTENTOS`  | 429    | Más de 5 logins con el mismo email en 15 min |
| `DEMASIADOS_REGISTROS` | 429    | Más de 10 registros desde la misma IP en 1 hora |

Internamente, los services lanzan `AppError(status, message, code)` ([src/utils/AppError.js](src/utils/AppError.js)) y el middleware [errorHandler.js](src/middlewares/errorHandler.js) lo convierte en la respuesta HTTP.

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
  config/
    env.js            # carga y valida las variables de entorno (se detiene si faltan o son inválidas)
    db.js             # conexión (pool) a PostgreSQL
  routes/             # define las rutas
    auth.router.js, autores.router.js, libros.router.js, prestamos.router.js, usuarios.router.js
  controllers/        # traduce la petición HTTP a llamadas al service
    auth_controller.js, autores_controller.js, libros_controller.js, prestamos_controller.js, usuarios_controller.js
  services/           # reglas de negocio y validaciones
    auth_services.js, autores_services.js, libros_services.js, prestamos_services.js, usuarios_services.js
  repositories/       # consultas SQL
    autores_repositories.js, libros_repositories.js, prestamos_repositories.js, usuarios_repositories.js
  middlewares/        # token JWT, roles, rate limiting y manejo de errores
    auth.js, authorize.js, rateLimit.js, errorHandler.js
  utils/              # código compartido
    AppError.js       # error con status HTTP y code
    validators.js     # validarId, usado por todos los services
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
- [x] Rate limiting en `/auth` y protección contra enumeración de usuarios
- [ ] Guardar los contadores del rate limiting en Redis (para varias instancias)
