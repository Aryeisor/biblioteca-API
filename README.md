# Biblioteca API

API REST para gestionar una biblioteca: autores, libros, usuarios y préstamos. Hecha con Node.js, TypeScript, Express 5 y PostgreSQL.

## Tecnologías

Node.js 22 · TypeScript (strict) · Express 5 · PostgreSQL 17 · ES Modules

| Área          | Qué se usa                                                                          |
| ------------- | ----------------------------------------------------------------------------------- |
| Lenguaje      | TypeScript estricto: `tsx` en desarrollo y pruebas, `tsc` para compilar a `dist/`   |
| Validación    | `zod`: los esquemas de `src/schemas/` validan la entrada y de ellos salen los tipos |
| Base de datos | `pg` (pool y transacciones), SQL a mano en `src/repositories/` (autores: Drizzle)   |
| Autenticación | `jsonwebtoken` (HS256) · `bcryptjs` · RBAC propio (`authorize`)                     |
| Seguridad     | `helmet` · `cors` con lista de orígenes · rate limiting propio (Redis o memoria)    |
| Configuración | `dotenv` + validación propia de variables en `src/config/env.ts`                    |
| Logs          | `pino` + `pino-http` (`pino-pretty` en desarrollo)                                  |
| Pruebas       | `node:test` + `node:assert/strict` + `supertest`                                    |
| Calidad       | ESLint 10 (`typescript-eslint`) + Prettier + `tsc --noEmit`                         |
| CI            | GitHub Actions: lint, formato, tipos, build, imagen Docker y pruebas                |
| Contenedores  | Docker + Docker Compose (API + PostgreSQL 17)                                       |

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

   # Frontends que pueden llamar a la API, separados por comas (vacío = ninguno)
   CORS_ORIGINS=

   # Nivel de logs: fatal, error, warn, info (por defecto), debug, trace o silent
   LOG_LEVEL=info

   # Redis para los contadores del rate limiting (opcional; sin ella se usa la memoria del proceso)
   # REDIS_URL=redis://localhost:6379

   DB_HOST=localhost
   DB_PORT=5432
   DB_USER=postgres
   DB_PASSWORD=tu_contraseña
   DB_NAME=biblioteca

   JWT_SECRET=cambia_esto_por_un_secreto_largo_y_aleatorio
   # Access token corto: la sesión se renueva sola con el refresh token
   JWT_EXPIRES_IN=15m

   # Días que dura una sesión sin volver a pedir la contraseña (entero entre 1 y 90)
   REFRESH_TOKEN_DIAS=7
   ```

   Para generar un `JWT_SECRET` seguro:

   ```bash
   node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
   ```

   Nunca subas el `.env` real al repositorio (contiene la contraseña de la BD y el secreto del JWT); solo se sube `.env.example`.

   Al arrancar, `src/config/env.ts` valida la configuración y la app se detiene con un mensaje claro si algo está mal:

   - Todas las variables de arriba son obligatorias, salvo `TRUST_PROXY`, `CORS_ORIGINS`, `LOG_LEVEL`, `REDIS_URL` y `REFRESH_TOKEN_DIAS`; si falta alguna, indica cuáles.
   - `PORT` y `DB_PORT` deben ser enteros entre 1 y 65535.
   - `JWT_SECRET` debe tener al menos 32 caracteres.
   - `TRUST_PROXY` es opcional (por defecto `0`) y debe ser un entero ≥ 0. Ver [IP real detrás de un proxy](#ip-real-detrás-de-un-proxy-trust_proxy).
   - `CORS_ORIGINS` es opcional (por defecto ninguno). Ver [CORS y headers de seguridad](#cors-y-headers-de-seguridad-cors_origins).
   - `LOG_LEVEL` es opcional (por defecto `info`) y debe ser uno de los niveles de arriba. Ver [Logs](#logs-log_level-y-x-request-id).
   - `REFRESH_TOKEN_DIAS` es opcional (por defecto `7`) y debe ser un entero entre 1 y 90. Ver [Sesiones](#sesiones-access-token-y-refresh-token).
   - `REDIS_URL` es opcional y, si se define, debe ser una URL `redis://` o `rediss://`. Ver [Rate limiting](#rate-limiting).

4. Crear la base de datos en PostgreSQL (desde psql o pgAdmin):

   ```sql
   CREATE DATABASE biblioteca;
   ```

5. Crear las tablas (aplica las migraciones de `db/migrations/`):

   ```bash
   npm run db:migrar
   ```

   Se puede ejecutar las veces que quieras: solo aplica las migraciones que faltan y anota cada una en la tabla `schema_migrations`. `npm run db:estado` muestra cuáles están aplicadas y cuáles pendientes. Si tu base ya tenía las tablas (se creó antes de existir el registro), ejecuta una vez `npm run db:migrar -- baseline 003` para anotar como aplicadas las migraciones existentes sin volver a ejecutarlas.

## Uso

```bash
npm run dev   # desarrollo con tsx, se reinicia al guardar cambios y muestra los logs legibles (pino-pretty)
npm run build # compila src/ a JavaScript en dist/
npm start     # producción: ejecuta dist/server.js (primero hay que hacer build)

npm test             # pruebas (ver Pruebas)
npm run lint         # ESLint sobre todo el proyecto
npm run typecheck    # tsc --noEmit: revisa los tipos de src, tests y db sin generar archivos
npm run format       # Prettier: formatea los archivos
npm run format:check # Prettier: solo revisa, no escribe (útil en CI)
```

La API queda en `http://localhost:3000`.

## Ejecución con Docker

Levanta la API, un PostgreSQL 17 y un Redis 7 en contenedores, sin instalar Node ni PostgreSQL en tu equipo.

Requisito: [Docker Desktop](https://www.docker.com/products/docker-desktop/).

1. Copiar `.env.example` a `.env` y completar los datos (el mismo archivo de la [instalación](#instalación)). Compose usa `DB_USER`, `DB_PASSWORD` y `DB_NAME` para crear la base del contenedor, y `PORT`, `JWT_SECRET`, `JWT_EXPIRES_IN`, `REFRESH_TOKEN_DIAS`, `CORS_ORIGINS`, `TRUST_PROXY` y `LOG_LEVEL` para la API (los tres últimos tienen valor por defecto si no están en el `.env`).

2. Construir y levantar los contenedores:

   ```bash
   docker compose up --build
   ```

   La API queda en `http://localhost:3000`. Compose espera a que PostgreSQL esté listo (healthcheck con `pg_isready`) antes de arrancar la API.

   La API también tiene su healthcheck: cada 10 s consulta `GET /health` con `wget`, y `docker compose ps` la muestra como `(healthy)`. Usa `/health` y no `/health/ready` a propósito: si la base se cae, reiniciar la API no lo arregla. Ver [Health checks](#health-checks--health).

- **Las migraciones se aplican solas en cada arranque.** El servicio `migrar` ejecuta las migraciones pendientes y termina; la API no arranca hasta que termina bien. Si ya tenías un volumen creado con la versión anterior (sin registro de migraciones), o borras los datos con `docker compose down -v`, o anotas el estado actual con `docker compose run --rm migrar node dist/migraciones/cli.js baseline 003`.
- **Redis guarda los contadores del rate limiting.** Compose lo levanta, le fija `REDIS_URL=redis://redis:6379` a la API y espera a que esté sano antes de arrancarla. No tiene persistencia a propósito: si se reinicia, los contadores empiezan en 0. Su puerto solo se publica en `127.0.0.1:6379` (no en la red) para poder usarlo desde tu equipo: `docker compose up -d redis` basta para correr `npm run dev` o los tests con Redis.
- **La base del contenedor es independiente de tu PostgreSQL local.** Tienen datos distintos aunque se llamen igual. Compose fija `DB_HOST=db` (el nombre del servicio) y `DB_PORT=5432`, así que los valores de `DB_HOST` y `DB_PORT` de tu `.env` solo se usan al correr la API sin Docker.

| Comando                      | Qué hace                                                                      |
| ---------------------------- | ----------------------------------------------------------------------------- |
| `docker compose up -d`       | Levanta los contenedores en segundo plano                                     |
| `docker compose logs -f api` | Muestra los logs de la API en vivo                                            |
| `docker compose down`        | Detiene y elimina los contenedores (conserva los datos)                       |
| `docker compose down -v`     | Igual, pero también **borra el volumen con los datos**                        |
| `docker compose stop api`    | Detiene la API con un [apagado ordenado](#apagado-ordenado-graceful-shutdown) |

No ejecutes `npm run dev` y Docker a la vez: los dos usan el puerto 3000 y el segundo en arrancar falla.

El puerto de PostgreSQL no se publica en el equipo: la API se conecta por la red interna de Compose. Si quieres conectarte a la base del contenedor con psql o DBeaver, agrega esto al servicio `db` en `docker-compose.yml` y conéctate a `localhost:5433` (se usa 5433 para no chocar con un PostgreSQL local en 5432):

```yaml
ports:
  - '5433:5432'
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
   CORS_ORIGINS=http://localhost:5173
   LOG_LEVEL=silent
   REDIS_URL=redis://localhost:6379
   ```

   `LOG_LEVEL=silent` evita que los logs llenen la salida de `npm test`. `REDIS_URL` es para los tests del almacén de Redis (`docker compose up -d redis` lo levanta); si no la defines, esos tests se omiten y el resto corre igual, porque la app en los tests siempre usa el almacén en memoria.

   Igual que el `.env`, el `.env.test` real no se sube al repositorio.

2. Crear la base de prueba y sus tablas:

   ```bash
   npm run db:init:test
   ```

   Crea `biblioteca_test` si no existe y aplica las migraciones. Ojo: cada vez que se ejecuta **borra y recrea el esquema** de la base de prueba (así siempre refleja las migraciones), por lo que se pierden sus datos.

3. Ejecutar los tests:

   ```bash
   npm test
   ```

   Los archivos de `tests/` se ejecutan uno a uno (`--test-concurrency=1`) porque comparten la misma base; cada archivo vacía las tablas al empezar.

Como protección, tanto `npm run db:init:test` como los tests se niegan a correr si `DB_NAME` no termina en `_test`.

Supertest hace todas las peticiones desde la misma IP, así que los tests chocarían con el [rate limiting](#rate-limiting). En vez de desactivarlo, `tests/helpers.ts` llama a `reiniciarLimites()` en un `beforeEach`: cada test empieza con los contadores en 0 y se prueba con los límites reales.

Los tests cubren:

- **Autenticación**: registro (email en minúsculas, sin password en la respuesta, email repetido, contraseña corta, email inválido), login correcto e incorrecto (mismo mensaje 401), rutas protegidas sin token o con token inválido, token vencido (`TOKEN_EXPIRADO`) y token con la firma alterada (`TOKEN_INVALIDO`).
- **Rate limiting**: el 6.º intento con el mismo email (aunque cambien mayúsculas o espacios) da 429 con `Retry-After`, bloquear un email no afecta a otro, el límite por IP, y un `X-Forwarded-For` inventado no esquiva el límite.
- **Autores**: validación del body.
- **Libros**: rutas públicas y protegidas, autor inexistente, stock negativo, ISBN repetido, JSON mal formado (400), `PATCH /libros/:id/stock`, filtro por título y paginación (páginas distintas, total con filtro, límite inválido y página fuera de rango).
- **Usuarios**: todas las rutas requieren token, nunca se devuelve el password, y `PUT`/`DELETE` sobre otro usuario responden 403; paginación por offset (páginas distintas, página fuera de rango con el total real y parámetros inválidos).
- **Préstamos**: el usuario se toma del token, el stock baja al prestar y sube al devolver, sin stock responde 409, un préstamo solo se puede devolver una vez (409 y el stock no vuelve a subir) y solo por su dueño (403); paginación con cursor (recorrer todas las páginas sin repetidos ni faltantes, combinada con `activos=true` y con el filtro del lector, cursor inválido).
- **Concurrencia**: con un libro de stock 1, dos préstamos simultáneos de usuarios distintos no pueden ocurrir a la vez: uno responde 201, el otro 409 y el stock queda en 0.
- **Roles (RBAC)**: cada endpoint rechaza con 403 `PERMISO_DENEGADO` a los roles que no le corresponden; un lector no puede devolver préstamos ni listar usuarios; un admin no puede quitarse el rol ni borrarse a sí mismo; el `rol` enviado en `POST /auth/registrar` se ignora.
- **Health checks**: `/health` responde siempre y `/health/ready` responde 503 cuando la base no está disponible.
- **Seguridad**: headers de helmet, ausencia de `X-Powered-By`, CORS según `CORS_ORIGINS` y `X-Request-Id` (se reutiliza el del cliente solo si es válido).
- **Peticiones sin body**: responden 400 en vez de 500.

## Autenticación

La API usa JWT. Las contraseñas se guardan como hash con bcrypt y nunca se devuelven en las respuestas.

### Auth — `/auth`

| Método | Ruta                | Descripción                       | Body                                                                                 |
| ------ | ------------------- | --------------------------------- | ------------------------------------------------------------------------------------ |
| POST   | `/auth/registrar`   | Registra un usuario               | `{ "nombre": "Ana Pérez", "email": "ana@correo.com", "password": "unaClaveSegura" }` |
| POST   | `/auth/login`       | Inicia sesión y devuelve un token | `{ "email": "ana@correo.com", "password": "unaClaveSegura" }`                        |
| POST   | `/auth/refresh`     | Renueva la sesión (cookie)        | — (usa la cookie `refresh_token`)                                                    |
| POST   | `/auth/logout`      | Cierra la sesión de este equipo   | — (usa la cookie `refresh_token`)                                                    |
| POST   | `/auth/logout-todo` | Cierra todas tus sesiones         | — (requiere `Authorization: Bearer <token>`)                                         |

- `POST /auth/registrar` responde `201` con el usuario creado, sin password (`id`, `nombre`, `email`, `created_at`). Reglas: `nombre` y `email` igual que en usuarios; `password` obligatorio, mínimo 8 caracteres y máximo 72 **bytes** (límite de bcrypt: una "ñ" ocupa 2 bytes y un emoji 4, así que con emojis el tope real son menos caracteres); email único (si se repite responde 409).
- `POST /auth/login` responde `200` con `{ "token": "..." }` (el access token) y además guarda el refresh token en una cookie `httpOnly` (ver [Sesiones](#sesiones-access-token-y-refresh-token)). Si falta el email o la contraseña responde 400. Si el email no existe o la contraseña no coincide responde `401` con `{ "message": "Credenciales invalidas" }`: es el mismo mensaje en ambos casos a propósito, para no revelar qué emails están registrados. Por la misma razón, ambos casos **tardan lo mismo**: si el email no existe, se ejecuta igual un `bcrypt.compare` contra un hash ficticio (calculado una sola vez al cargar el módulo, con el mismo costo que los hashes reales). Sin esto, la respuesta rápida delataría qué emails no existen.

### Rate limiting

Las rutas de `/auth` tienen límite de intentos para frenar la fuerza bruta ([src/middlewares/rateLimit.ts](src/middlewares/rateLimit.ts), ventana fija):

| Ruta                   | Clave                                | Límite         | `code` al superarlo     |
| ---------------------- | ------------------------------------ | -------------- | ----------------------- |
| `POST /auth/login`     | IP                                   | 20 cada 15 min | `DEMASIADAS_PETICIONES` |
| `POST /auth/login`     | email (sin espacios y en minúsculas) | 5 cada 15 min  | `DEMASIADOS_INTENTOS`   |
| `POST /auth/registrar` | IP                                   | 10 cada hora   | `DEMASIADOS_REGISTROS`  |

Al superar el límite responde `429` con el header `Retry-After` (segundos que faltan para que se reinicie la ventana).

**Dónde se guardan los contadores.** El middleware solo conoce la forma de un almacén (`src/limites/almacen.ts`) y hay dos implementaciones:

- **Redis** (si defines `REDIS_URL`): todas las instancias de la API comparten los mismos contadores, así que el límite es el mismo con 1 o con 10 instancias, y sobreviven a reiniciar la API. Cada petición ejecuta un script Lua que hace `INCR` y `PEXPIRE` de forma atómica: si fueran dos comandos y el proceso muriera entre ellos, la clave quedaría sin expiración y bloquearía a su dueño para siempre.
- **Memoria** (sin `REDIS_URL`): un `Map` en el proceso. Sirve en desarrollo y con una sola instancia; se pierde al reiniciar y no se comparte (con 3 instancias, el límite real se triplica). La API lo avisa con un `warn` al arrancar.

Las claves se guardan como `rl:<code>:<huella SHA-256>`: la huella acota el tamaño de la clave (el email viene del body) y evita guardar emails en Redis.

**Si Redis falla** (caído, o tarda más de 500 ms) la petición **se deja pasar** y se registra un error en el log ("fail open"). La alternativa, rechazar todo, dejaría a todos los usuarios sin poder entrar porque se cayó un servicio auxiliar. El costo: mientras Redis esté caído no hay protección contra fuerza bruta. Al arrancar, en cambio, si `REDIS_URL` está definida y no se puede conectar, la API no arranca (misma lógica que con la base de datos). El readiness `/health/ready` no depende de Redis a propósito: con "fail open" la API puede atender sin él.

### CORS y headers de seguridad (`CORS_ORIGINS`)

- **helmet** agrega headers de seguridad a cada respuesta (por ejemplo `X-Content-Type-Options: nosniff`) y quita `X-Powered-By`, que delataba que la API usa Express.
- **cors** solo agrega `Access-Control-Allow-Origin` cuando el `Origin` de la petición está en `CORS_ORIGINS`. Con otro origen no responde error: no pone el header y es el **navegador** el que bloquea la respuesta. Por eso CORS no protege contra curl ni Postman; solo controla qué páginas web pueden leer la API desde el navegador.
- Va antes de las rutas y de la autenticación: el preflight `OPTIONS` del navegador no trae el token, así que si llegara al middleware de auth recibiría 401 y el navegador cancelaría la petición real.

### Logs (`LOG_LEVEL` y `X-Request-Id`)

La API usa [pino](https://github.com/pinojs/pino) con `pino-http`: escribe una línea JSON por petición (método, ruta, status, duración) y por cada error.

- **Health checks:** `/health` y `/health/ready` no generan la línea automática por petición (el healthcheck de Docker las llama cada 10 s); si `/health/ready` falla, el error sí queda en el log.
- **Formato:** en producción (`npm start`, Docker) sale en JSON, listo para un sistema de logs. `npm run dev` lo pasa por `pino-pretty` para leerlo en la terminal.
- **Nivel:** `LOG_LEVEL` (por defecto `info`). En los tests es `silent`.
- **Datos ocultos:** el header `Authorization` y cualquier campo `password` se reemplazan por `[OCULTO]` antes de escribir el log.
- **`X-Request-Id`:** cada respuesta trae este header con el id de la petición, y el mismo id aparece en sus logs (`reqId`). Si el cliente envía su propio `X-Request-Id`, se reutiliza solo si tiene de 1 a 64 caracteres entre letras, números, `.`, `_` y `-`; si no, se genera un UUID nuevo. Así un cliente no puede meter textos enormes ni caracteres raros en los logs.
- **Errores 500:** la respuesta incluye el `requestId`. El cliente puede reportarlo y con él se busca el error completo en los logs, sin mostrarle detalles internos:

  ```json
  { "code": "ERROR_INTERNO", "message": "Error interno del servidor", "requestId": "3f2b8c1e-..." }
  ```

### IP real detrás de un proxy (`TRUST_PROXY`)

El límite por IP usa `req.ip`. Detrás de un Nginx o balanceador, todas las peticiones llegarían con la IP del proxy y todos los usuarios compartirían el mismo contador. `app.set('trust proxy', config.trustProxy)` le dice a Express cuántos proxies debe creer al leer `X-Forwarded-For`:

- `0` (por defecto): sin proxy, como en local. Ignora `X-Forwarded-For`.
- `1`: detrás de un Nginx o balanceador que tú controlas.
- Nunca `true`: Express le creería a cualquier `X-Forwarded-For`, incluso al que inventa el cliente, y el límite por IP dejaría de servir.

### Sesiones: access token y refresh token

Un solo token largo es un riesgo: si lo roban, sirve hasta que venza. Por eso hay dos:

|                | Access token                                                                                | Refresh token                                                |
| -------------- | ------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| Qué es         | JWT firmado con HS256                                                                       | 32 bytes aleatorios, opaco                                   |
| Dura           | `JWT_EXPIRES_IN` (recomendado `15m`)                                                        | `REFRESH_TOKEN_DIAS` (por defecto 7 días)                    |
| Dónde viaja    | Header `Authorization: Bearer` (el frontend lo guarda **en memoria**, no en `localStorage`) | Cookie `refresh_token`                                       |
| Para qué sirve | Llamar a la API                                                                             | Solo para pedir un access token nuevo (`POST /auth/refresh`) |

La cookie es `HttpOnly` (el JavaScript de la página no puede leerla, así que un XSS no se la lleva), `SameSite=Strict` y `Path=/auth` (el navegador solo la envía a `/auth/*` y desde el mismo sitio, lo que frena el CSRF), y `Secure` cuando la petición llega por HTTPS (detrás de un proxy hay que configurar bien [`TRUST_PROXY`](#ip-real-detrás-de-un-proxy-trust_proxy)). Para que el navegador la envíe desde el frontend, `fetch` debe usar `credentials: 'include'` y el origen del frontend debe estar en `CORS_ORIGINS`. Se asume que frontend y API son del mismo _sitio_ (por ejemplo `localhost:5173` y `localhost:3000`, o `app.midominio.com` y `api.midominio.com`); con dominios distintos haría falta `SameSite=None` y una defensa CSRF adicional.

**Rotación.** Cada `POST /auth/refresh` marca el refresh token como usado y entrega uno nuevo (la cookie se reemplaza sola). Los tokens se guardan en la tabla `refresh_tokens` **solo como huella SHA-256**: quien lea la base no puede usarlos. Cada login abre una "familia" de tokens.

**Detección de robo.** Si llega un token que ya fue usado, alguien lo copió (el dueño ya lo cambió por uno nuevo). La API revoca la familia completa y responde `401`; el dueño legítimo también tiene que iniciar sesión otra vez, que es el precio de cortar al ladrón. Excepción: dentro de los 10 segundos siguientes al uso, se responde `409 REFRESH_EN_CURSO` sin revocar nada, porque lo normal es una carrera legítima (dos pestañas renovando a la vez); el cliente debe reintentar.

**Rol al día.** Cada refresh vuelve a leer el rol del usuario en la base, así que un cambio de rol llega como máximo al renovar el access token (≤ `JWT_EXPIRES_IN`), no al cabo de días.

**Cerrar sesión.** `POST /auth/logout` revoca la familia del navegador actual y borra la cookie (responde 204 aunque no hubiera sesión). `POST /auth/logout-todo` (con access token) revoca todas las sesiones del usuario.

Los tokens vencidos de un usuario se borran al iniciar sesión.

### Cómo usar el token

Envía el token en el header de cada petición protegida:

```text
Authorization: Bearer <token>
```

En Insomnia: pestaña **Auth** → **Bearer Token** → pega el token en el campo _Token_.

El token se firma y se verifica solo con el algoritmo `HS256` (se rechaza cualquier token firmado con otro algoritmo). Expira según `JWT_EXPIRES_IN` (por ejemplo `15m`); cuando expira, la API responde 401 con el código `TOKEN_EXPIRADO` y el cliente pide uno nuevo con `POST /auth/refresh` (o vuelve a hacer login si la sesión también venció).

### Rutas protegidas y roles (RBAC)

Cada usuario tiene un rol: `lector` (por defecto), `bibliotecario` o `admin`. El rol se guarda en la columna `usuarios.rol`, viaja dentro del JWT y lo verifica el middleware [authorize.ts](src/middlewares/authorize.ts) en cada ruta. Si el rol no alcanza, la respuesta es `403` con `code: "PERMISO_DENEGADO"`.

| Módulo    | Públicas (sin token)                                                                  | lector                                                           | bibliotecario                                        | admin                            |
| --------- | ------------------------------------------------------------------------------------- | ---------------------------------------------------------------- | ---------------------------------------------------- | -------------------------------- |
| Auth      | `POST /auth/registrar`, `POST /auth/login`, `POST /auth/refresh`, `POST /auth/logout` | —                                                                | —                                                    | —                                |
| Autores   | `GET /autores`, `GET /autores/:id`                                                    | no puede escribir                                                | `POST`, `PUT`                                        | `POST`, `PUT`, `DELETE`          |
| Libros    | `GET /libros`, `GET /libros/:id`                                                      | no puede escribir                                                | `POST`, `PUT`, `PATCH /libros/:id/stock`             | lo anterior + `DELETE`           |
| Usuarios  | —                                                                                     | solo su propio usuario (`GET /usuarios/:id`, `PUT`, `DELETE`)    | `GET /usuarios` + su propio usuario                  | todo + `PATCH /usuarios/:id/rol` |
| Préstamos | —                                                                                     | `GET` (solo los suyos) y `POST` (a su nombre); no puede devolver | `GET` todos, `POST`, `PATCH /prestamos/:id/devolver` | igual que bibliotecario          |
| Auditoría | —                                                                                     | —                                                                | —                                                    | `GET /auditoria`                 |

Reglas que no dependen solo del rol (las aplica el service, porque dependen del registro pedido):

- El `rol` que venga en `POST /auth/registrar` se ignora: todo registro nuevo queda como `lector`. El primer `admin` se crea con un `UPDATE` directo en la base, nunca desde la API.
- Un lector solo ve y modifica su propio usuario y sus propios préstamos; un admin puede sobre cualquiera.
- `POST /prestamos`: el lector siempre presta a su nombre (se ignora el `usuarioId` del body); bibliotecario y admin pueden prestar a nombre de otro.
- Un admin no puede borrarse ni quitarse el rol a sí mismo (`400`), así el sistema nunca queda sin admins.
- **Limitación:** el rol viaja en el JWT, así que un cambio de rol surte efecto cuando el access token se renueva (`POST /auth/refresh`) o el usuario vuelve a iniciar sesión: como máximo `JWT_EXPIRES_IN` después.

La matriz completa, con la justificación de cada decisión, está en [docs/rbac-matriz-permisos.md](docs/rbac-matriz-permisos.md).

Errores de token (todos con estado `401`):

| Caso                                               | Respuesta                                                     |
| -------------------------------------------------- | ------------------------------------------------------------- |
| Sin header `Authorization`                         | `{ "code": "TOKEN_REQUERIDO", "message": "Token requerido" }` |
| Token expirado                                     | `{ "code": "TOKEN_EXPIRADO", "message": "El token expiró" }`  |
| Token mal formado, firma alterada u otro algoritmo | `{ "code": "TOKEN_INVALIDO", "message": "Token inválido" }`   |

## Endpoints

### Health checks — `/health`

Públicos: sin token y sin rate limiting. No muestran detalles internos; el error real queda en los logs.

| Método | Ruta            | Pregunta                                     | Respuesta                                                                                                                                   |
| ------ | --------------- | -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| GET    | `/health`       | ¿El proceso está vivo? (liveness)            | `200 { "status": "ok" }` siempre que responda; no toca la base                                                                              |
| GET    | `/health/ready` | ¿Puede atender peticiones ahora? (readiness) | `200 { "status": "ok" }` si la base responde a `SELECT 1`; `503 APAGANDO` durante el apagado; `503 BD_NO_DISPONIBLE` si la base no responde |

Un balanceador debe usar `/health/ready` para decidir si envía tráfico, y `/health` para decidir si reinicia el proceso.

### Apagado ordenado (graceful shutdown)

Al recibir `SIGTERM` (lo que envía `docker stop`) o `SIGINT` (Ctrl+C), `src/server.ts` apaga la API sin cortar las peticiones en curso:

1. Marca el proceso como "apagando": `/health/ready` empieza a responder 503 para que el balanceador deje de enviar tráfico.
2. `server.close()`: deja de aceptar conexiones nuevas y espera a que terminen las peticiones en curso.
   Además cierra de inmediato las conexiones keep-alive inactivas (`server.closeIdleConnections()`), que si no retrasarían el cierre.
3. Cierra el pool de PostgreSQL (después del servidor, porque esas últimas peticiones aún lo usan).
4. Sale con código 0.

Si algo se cuelga, un temporizador de seguridad fuerza la salida con código 1 a los 10 s. En `docker-compose.yml`, `stop_grace_period: 15s` le da tiempo a ese temporizador antes de que Docker mande `SIGKILL`. Una segunda señal no repite el apagado. Cada paso queda en los logs; para comprobarlo:

```bash
docker compose up -d --build
docker compose stop api
docker compose logs api   # señal recibida → servidor HTTP cerrado → pool cerrado → apagado completo
```

En Windows, fuera de Docker, solo llega `SIGINT` (Ctrl+C).

### Autores — `/autores`

| Método | Ruta           | Descripción             | Body                                     |
| ------ | -------------- | ----------------------- | ---------------------------------------- |
| GET    | `/autores`     | Lista todos los autores | —                                        |
| GET    | `/autores/:id` | Obtiene un autor        | —                                        |
| POST   | `/autores`     | Crea un autor           | `{ "nombre": "Gabriel García Márquez" }` |
| PUT    | `/autores/:id` | Actualiza un autor      | `{ "nombre": "..." }`                    |
| DELETE | `/autores/:id` | Elimina un autor        | —                                        |

Reglas: `nombre` obligatorio (máx. 100 caracteres).

### Libros — `/libros`

| Método | Ruta                         | Descripción                                       | Body                                                                                       |
| ------ | ---------------------------- | ------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| GET    | `/libros`                    | Lista los libros paginados (con nombre del autor) | —                                                                                          |
| GET    | `/libros?titulo=cien`        | Filtra por título (sin distinguir mayúsculas)     | —                                                                                          |
| GET    | `/libros?pagina=2&limite=10` | Página concreta (se combina con `titulo`)         | —                                                                                          |
| GET    | `/libros/:id`                | Obtiene un libro                                  | —                                                                                          |
| POST   | `/libros`                    | Crea un libro                                     | `{ "titulo": "Cien años de soledad", "isbn": "978-0307474728", "autorId": 1, "stock": 3 }` |
| PUT    | `/libros/:id`                | Actualiza un libro                                | Igual que POST                                                                             |
| PATCH  | `/libros/:id/stock`          | Cambia solo el stock del libro                    | `{ "stock": 5 }`                                                                           |
| DELETE | `/libros/:id`                | Elimina un libro                                  | —                                                                                          |

Reglas: `titulo` obligatorio (máx. 200 caracteres); `isbn` opcional y único (máx. 20); `autorId` debe existir (si no, 404); `stock` entero ≥ 0, por defecto 0 (en el PATCH es obligatorio).

#### Paginación de `GET /libros`

| Parámetro | Tipo   | Por defecto | Reglas        |
| --------- | ------ | ----------- | ------------- |
| `pagina`  | entero | `1`         | ≥ 1           |
| `limite`  | entero | `20`        | entre 1 y 100 |

Un valor fuera de rango o que no sea entero (ej. `limite=5000`, `pagina=abc`) responde **400**; no se recorta en silencio, para que el cliente sepa que pidió algo inválido.

La respuesta es un objeto con los datos de la página y la información para navegar:

```json
{
  "data": [
    {
      "id": 1,
      "titulo": "Cien años de soledad",
      "isbn": "111",
      "stock": 3,
      "autor_id": 1,
      "autor": "Gabriel García Márquez"
    }
  ],
  "paginacion": { "pagina": 1, "limite": 20, "total": 13, "totalPaginas": 1 }
}
```

- `total` cuenta los libros que cumplen el filtro `titulo`, no solo los de la página.
- Pedir una página que no existe (ej. `pagina=99`) responde 200 con `data: []` y el `total` real.

### Usuarios — `/usuarios`

| Método | Ruta                | Descripción                                          | Body                                                   |
| ------ | ------------------- | ---------------------------------------------------- | ------------------------------------------------------ |
| GET    | `/usuarios`         | Lista los usuarios paginados (`?pagina=2&limite=10`) | —                                                      |
| GET    | `/usuarios/:id`     | Obtiene un usuario                                   | —                                                      |
| PUT    | `/usuarios/:id`     | Actualiza tu propio usuario                          | `{ "nombre": "Ana Pérez", "email": "ana@correo.com" }` |
| DELETE | `/usuarios/:id`     | Elimina tu propio usuario                            | —                                                      |
| PATCH  | `/usuarios/:id/rol` | Cambia el rol de un usuario (solo admin)             | `{ "rol": "bibliotecario" }`                           |

El alta de usuarios se hace con `POST /auth/registrar`. Todas las rutas requieren token; para un lector, `GET /usuarios/:id`, `PUT` y `DELETE` sobre otro usuario responden 403. `GET /usuarios` es solo para bibliotecario y admin. `PATCH /usuarios/:id/rol` es solo de admin: el `rol` debe ser `lector`, `bibliotecario` o `admin` (si no, 400) y un admin no puede quitarse el rol a sí mismo ni borrarse (400). Ver [rutas protegidas y roles](#rutas-protegidas-y-roles-rbac).

Reglas: `nombre` obligatorio (máx. 100 caracteres); `email` obligatorio, con formato válido, único (máx. 150) y se guarda en minúsculas.

`GET /usuarios` se pagina por offset igual que `GET /libros`: mismos parámetros (`pagina`, `limite`), mismas reglas y misma respuesta `{ data, paginacion }` (ver [paginación de libros](#paginación-de-get-libros)). Ordena por `id`.

### Préstamos — `/prestamos`

| Método | Ruta                              | Descripción                                                                         | Body               |
| ------ | --------------------------------- | ----------------------------------------------------------------------------------- | ------------------ |
| GET    | `/prestamos`                      | Lista los préstamos paginados, del más reciente al más viejo (con título y usuario) | —                  |
| GET    | `/prestamos?activos=true`         | Lista solo los préstamos no devueltos                                               | —                  |
| GET    | `/prestamos?cursor=...&limite=10` | Página siguiente (se combina con `activos`)                                         | —                  |
| GET    | `/prestamos/:id`                  | Obtiene un préstamo                                                                 | —                  |
| POST   | `/prestamos`                      | Presta un libro al usuario autenticado (descuenta 1 de stock)                       | `{ "libroId": 1 }` |
| PATCH  | `/prestamos/:id/devolver`         | Marca tu préstamo como devuelto (suma 1 al stock)                                   | —                  |

Reglas: todas las rutas requieren token. Para un lector, el usuario del préstamo se toma del token y no del body (bibliotecario y admin sí pueden enviar `usuarioId`), solo ve sus propios préstamos y no puede devolver: `PATCH /prestamos/:id/devolver` es de bibliotecario o admin. Un mismo usuario no puede tener dos préstamos activos del mismo libro (409 `PRESTAMO_DUPLICADO`, garantizado por un índice único parcial en la base). El libro y el usuario deben existir (si no, 404); si el libro no tiene stock responde 409; devolver un préstamo de otro usuario responde 403; devolver un préstamo ya devuelto responde 409. Prestar y devolver se hacen en una transacción (`BEGIN`/`COMMIT`, con `SELECT ... FOR UPDATE`), así el stock y el préstamo nunca quedan desincronizados aunque lleguen peticiones a la vez.

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

| Parámetro | Tipo   | Por defecto        | Reglas                                                                                                |
| --------- | ------ | ------------------ | ----------------------------------------------------------------------------------------------------- |
| `limite`  | entero | `20`               | entre 1 y 100; si no, **400**                                                                         |
| `cursor`  | texto  | — (primera página) | el `siguienteCursor` de la respuesta anterior; si no es válido, **400** con `code: "CURSOR_INVALIDO"` |

```json
{
  "data": [
    {
      "id": 42,
      "fecha_prestamo": "2026-11-17T15:02:11.000Z",
      "fecha_devolucion": null,
      "libro_id": 3,
      "libro": "Ficciones",
      "usuario_id": 1,
      "usuario": "Ana"
    }
  ],
  "paginacion": { "limite": 20, "siguienteCursor": "eyJpZCI6NDJ9" }
}
```

- Para la página siguiente se repite la misma petición (con los mismos filtros) agregando `cursor=<siguienteCursor>`. Cuando `siguienteCursor` es `null`, no hay más páginas.
- El cursor es **opaco**: hay que usarlo tal cual, sin construirlo ni interpretarlo. Su contenido puede cambiar (por ejemplo, si el orden pasa a ser por fecha).
- No hay `total` ni `totalPaginas`: contar todo el historial en cada petición sería caro, y un historial no se navega saltando a "la página 7".
- Un lector solo pagina sus propios préstamos; el filtro por usuario se aplica junto con el cursor.

### Auditoría — `/auditoria`

Registro de lo que ocurre en torno a la seguridad. Solo lo ve el `admin`.

| Método | Ruta         | Descripción                                        |
| ------ | ------------ | -------------------------------------------------- |
| GET    | `/auditoria` | Lista las entradas, de la más nueva a la más vieja |

Parámetros opcionales (en la URL): `accion` (una de las de la tabla de abajo), `actorId` (quién lo hizo), `limite` (1 a 200, por defecto 50) y `cursor` (el `siguienteCursor` de la respuesta anterior). La respuesta es `{ "data": [...], "paginacion": { "limite": 50, "siguienteCursor": "..." } }`. Un filtro inválido responde `400`.

Cada entrada trae `id`, `creado_en`, `accion`, `actor_id`, `objetivo_id`, `ip`, `request_id` (el `X-Request-Id` de la petición: sirve para encontrar los logs de esa misma petición) y `detalle`.

**Qué se audita:**

| `accion`                  | Cuándo                                    | `detalle`                                 |
| ------------------------- | ----------------------------------------- | ----------------------------------------- |
| `registro`                | Alguien se registra                       | —                                         |
| `login_exitoso`           | Login correcto                            | —                                         |
| `login_fallido`           | Email inexistente o contraseña incorrecta | `motivo` y `email_huella` (16 caracteres) |
| `refresh_reuso_detectado` | Se reutiliza un refresh token ya usado    | `familia_id`                              |
| `logout`, `logout_todo`   | Cierre de sesión                          | —                                         |
| `rol_cambiado`            | Un admin cambia el rol de alguien         | `de` y `a`                                |
| `usuario_eliminado`       | Se borra un usuario                       | `autoeliminado`                           |

**Qué NO se guarda, a propósito:** contraseñas, tokens, ni el email completo. En un login fallido el email se guarda solo como huella (un SHA-256 recortado): sirve para ver que el mismo correo se intentó varias veces, pero no se recupera. Tampoco se guarda el email de un usuario eliminado: la auditoría no debe conservar datos personales de alguien que ya no existe. Las lecturas (GET) no se auditan.

**Cómo se escribe:**

- Los cambios sensibles (`rol_cambiado`, `usuario_eliminado`, `logout`, `logout_todo`, `refresh_reuso_detectado`) se registran **en la misma transacción** que el cambio: o ocurren los dos o ninguno. No puede existir un cambio de rol sin su rastro.
- Los eventos de login y registro se escriben **sin bloquear**: si la tabla de auditoría falla, se deja un error en el log, pero el usuario puede entrar igual. Se prefiere que el login funcione a que una falla de la auditoría deje a todos fuera.
- La tabla `audit_log` es de **solo escritura**: un trigger rechaza `UPDATE` y `DELETE`. No protege contra quien sea dueño de la tabla (puede desactivar el trigger); en producción la API debería conectarse con un rol que solo tenga `INSERT` y `SELECT`.
- `actor_id` y `objetivo_id` no tienen clave foránea: el registro sobrevive aunque el usuario se elimine.
- No hay política de retención todavía: la tabla crece sin límite. Borrar entradas viejas requeriría un rol de mantenimiento (el trigger se lo impide al rol de la API).

### Respuestas exitosas

| Código | Cuándo                                                                                   |
| ------ | ---------------------------------------------------------------------------------------- |
| 200    | Consultas (GET) y actualizaciones (PUT, PATCH, incluido `PATCH /prestamos/:id/devolver`) |
| 201    | Creación (POST), devuelve el registro creado                                             |
| 204    | Eliminación (DELETE), sin cuerpo en la respuesta                                         |

### Respuestas de error

Todos los errores responden con `{ "message": "..." }`, y algunos incluyen además un `code` estable para que el frontend no dependa del texto del mensaje:

```json
{ "code": "TOKEN_EXPIRADO", "message": "El token expiró" }
```

| Código | Cuándo                                                                                                                                                   |
| ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 400    | ID inválido, datos incorrectos (ej. nombre vacío, título de más de 200 caracteres o stock negativo) o cuerpo que no es un JSON válido                    |
| 401    | Token ausente, inválido o expirado; o credenciales inválidas en el login                                                                                 |
| 403    | Rol sin permiso para el endpoint, o acción sobre recursos de otro usuario (modificar/eliminar otro usuario o ver un préstamo ajeno)                      |
| 404    | El registro o la ruta no existe                                                                                                                          |
| 409    | Valor duplicado (ej. ISBN o email repetido), se intenta borrar un registro relacionado (ej. un autor con libros), libro sin stock o préstamo ya devuelto |
| 429    | Demasiados intentos en `/auth` (ver [rate limiting](#rate-limiting)); incluye el header `Retry-After`                                                    |
| 500    | Error interno del servidor; incluye `requestId` para buscarlo en los [logs](#logs-log_level-y-x-request-id)                                              |
| 503    | `/health/ready`: la API se está apagando o la base no responde (ver [health checks](#health-checks--health))                                             |

Valores de `code`:

| `code`                  | Estado | Cuándo                                                                                    |
| ----------------------- | ------ | ----------------------------------------------------------------------------------------- |
| `TOKEN_REQUERIDO`       | 401    | No se envió el token                                                                      |
| `RUTA_NO_ENCONTRADA`    | 404    | La ruta no existe                                                                         |
| `APAGANDO`              | 503    | `/health/ready` durante el apagado                                                        |
| `BD_NO_DISPONIBLE`      | 503    | `/health/ready` cuando la base no responde                                                |
| `TOKEN_EXPIRADO`        | 401    | El token venció                                                                           |
| `TOKEN_INVALIDO`        | 401    | El token es inválido                                                                      |
| `JSON_INVALIDO`         | 400    | El cuerpo de la petición no es un JSON válido                                             |
| `CURSOR_INVALIDO`       | 400    | El `cursor` de `GET /prestamos` no es válido (no salió de una respuesta de la API)        |
| `PETICION_INVALIDA`     | 4xx    | Otros errores de la petición detectados por Express (ej. cuerpo demasiado grande)         |
| `PERMISO_DENEGADO`      | 403    | El rol del token no puede usar ese endpoint (ver [roles](#rutas-protegidas-y-roles-rbac)) |
| `REGISTRO_DUPLICADO`    | 409    | Valor único repetido (ISBN, email)                                                        |
| `PRESTAMO_DUPLICADO`    | 409    | El usuario ya tiene un préstamo activo de ese libro                                       |
| `REGISTRO_RELACIONADO`  | 409    | El registro está relacionado con otros datos (ej. borrar un autor con libros)             |
| `DEMASIADAS_PETICIONES` | 429    | Más de 20 logins desde la misma IP en 15 min                                              |
| `DEMASIADOS_INTENTOS`   | 429    | Más de 5 logins con el mismo email en 15 min                                              |
| `DEMASIADOS_REGISTROS`  | 429    | Más de 10 registros desde la misma IP en 1 hora                                           |
| `DEMASIADOS_REFRESCOS`  | 429    | Más de 60 renovaciones de sesión desde la misma IP en 15 min                              |
| `SESION_INVALIDA`       | 401    | El refresh token falta, no existe, venció, fue revocado o se reutilizó                    |
| `REFRESH_EN_CURSO`      | 409    | Otra petición acaba de renovar esa misma sesión; reintenta con la cookie nueva            |
| `ERROR_INTERNO`         | 500    | Error no controlado del servidor (la respuesta trae `requestId`)                          |

Internamente, los services lanzan `AppError(status, message, code)` ([src/utils/AppError.ts](src/utils/AppError.ts)) y el middleware [errorHandler.ts](src/middlewares/errorHandler.ts) lo convierte en la respuesta HTTP.

## Base de datos

| Tabla            | Descripción                                                                                                                                   |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `autores`        | Autores de los libros                                                                                                                         |
| `libros`         | Libros con ISBN único y stock; cada uno pertenece a un autor                                                                                  |
| `usuarios`       | Usuarios de la biblioteca, con email único, columna `password` (hash bcrypt, nunca se devuelve) y `rol` (`lector`, `bibliotecario` o `admin`) |
| `prestamos`      | Préstamos de libros a usuarios; `fecha_devolucion` vacía = no devuelto                                                                        |
| `audit_log`      | Auditoría: quién hizo qué, cuándo y desde dónde; solo escritura (ver [Auditoría](#auditoría--auditoria))                                      |
| `refresh_tokens` | Sesiones: huella SHA-256 del token, familia, vencimiento y marcas de uso/revocación (ver [Sesiones](#sesiones-access-token-y-refresh-token))  |

El esquema se construye **solo con migraciones** ([db/migrations/](db/migrations/)): `000` es el esquema inicial y cada archivo posterior es un cambio (`001` rol, `002` índice compuesto `(usuario_id, id)` de préstamos, `003` índice único parcial que impide dos préstamos activos del mismo libro por usuario, `004` email único sin distinguir mayúsculas, `005` columna `updated_at` mantenida por trigger en autores/libros/usuarios, `006` `password` obligatoria, `007` tabla `refresh_tokens`, `008` tabla `audit_log`). Las migraciones 004 y 006 fallan con un mensaje claro si tu base ya tiene datos que las incumplen (emails repetidos por mayúsculas o usuarios sin contraseña): arréglalos a mano y vuelve a ejecutar. No hay un `schema.sql` aparte que pueda quedar desactualizado.

Cómo funciona el ejecutor ([src/migraciones/](src/migraciones/)):

- Aplica en orden los archivos que faltan, cada uno dentro de una transacción junto con su registro en `schema_migrations`: o se aplica completo o no queda rastro.
- Guarda una huella (SHA-256) de cada archivo. Si una migración ya aplicada se edita, se niega a continuar: el cambio va en una migración **nueva**.
- Un bloqueo de PostgreSQL (`pg_advisory_lock`) evita que dos ejecuciones corran a la vez.
- Para crear una migración nueva, agrega `db/migrations/007_descripcion.sql` con un número mayor al último. Si necesita `CREATE INDEX CONCURRENTLY` (no admite transacción), empieza el archivo con la línea `-- migrar:sin-transaccion`.

## Estructura del proyecto

```
db/
  init-test.ts        # crea la base de prueba (DB_NAME de .env.test) y recrea sus tablas
  migrations/         # el esquema, versionado: 000 inicial, 001 rol, 002 índice, 003 préstamo único, 004 email, 005 updated_at, 006 password
  scripts/            # seed-rendimiento.sql: datos de prueba para medir consultas
docs/
  rbac-matriz-permisos.md  # matriz de permisos por rol y las decisiones detrás
  evaluacion-orm.md        # experimento con Drizzle en un repositorio: hallazgos y decisión
src/
  server.ts           # punto de entrada: conecta a la BD, levanta el servidor y maneja el apagado ordenado
  app.ts              # configuración de Express y rutas
  orm/
    esquema.ts        # tabla autores descrita en TypeScript, solo para tipos (experimento con Drizzle)
    cliente.ts        # drizzle() sobre el Pool existente
  config/
    env.ts            # carga y valida las variables de entorno (se detiene si faltan o son inválidas)
    db.ts             # conexión (pool) a PostgreSQL
    logger.ts         # logger pino (nivel desde LOG_LEVEL, oculta Authorization y password)
    estado.ts         # estado "apagando": lo cambia server.ts y lo lee /health/ready
    redis.ts          # cliente de Redis (opcional, solo si hay REDIS_URL)
  routes/             # define las rutas
    auth.router.ts, autores.router.ts, health.router.ts, libros.router.ts, prestamos.router.ts, usuarios.router.ts
  controllers/        # traduce la petición HTTP a llamadas al service
    auth_controller.ts, autores_controller.ts, libros_controller.ts, prestamos_controller.ts, usuarios_controller.ts
  services/           # reglas de negocio; validan la entrada con los esquemas
    auth_services.ts, autores_services.ts, libros_services.ts, prestamos_services.ts, usuarios_services.ts
  limites/            # almacenes de contadores del rate limiting: memoria y Redis
    almacen.ts, almacenMemoria.ts, almacenRedis.ts
  migraciones/        # ejecutor de migraciones: ejecutor.ts (lógica) y cli.ts (npm run db:migrar)
  schemas/            # esquemas de Zod: validan la entrada y de ellos salen los tipos (z.infer)
    comunes.ts        # parsear(), validarId, paginación y texto obligatorio
    autores.ts, libros.ts, prestamos.ts, usuarios.ts
  repositories/       # consultas SQL tipadas
    autores_repositories.ts, libros_repositories.ts, prestamos_repositories.ts, usuarios_repositories.ts
  middlewares/        # token JWT, roles, rate limiting y manejo de errores
    auth.ts, authorize.ts, rateLimit.ts, errorHandler.ts
  types/
    dominio.ts        # tipos de las entidades (Autor, Libro, Usuario, Prestamo) y de los roles
    express.d.ts      # añade req.user (id y rol) al Request de Express
  utils/              # código compartido
    AppError.ts       # error con status HTTP y code
    paginacion.ts     # paginación por offset compartida por libros y usuarios
    filas.ts          # primeraFila: una fila garantizada de un INSERT ... RETURNING
    transaccion.ts    # enTransaccion: BEGIN/COMMIT/ROLLBACK y liberar la conexión
    cookies.ts        # leerCookie: lee una cookie del header (sin cookie-parser)
    contexto.ts       # contextoDe: IP y X-Request-Id de la petición, para la auditoría
    cursor.ts         # cursor opaco y paginarPorCursor (préstamos y auditoría)
tests/                # tests con node:test y Supertest contra la base de prueba
  helpers.ts, almacen-limites.test.ts, auth.test.ts, autores.test.ts, health.test.ts, libros.test.ts,
  prestamos.test.ts, seguridad.test.ts, sesiones.test.ts, usuarios.test.ts, auditoria.test.ts
.github/workflows/ci.yml  # integración continua (GitHub Actions)
tsconfig.json         # TypeScript estricto para revisar tipos (npm run typecheck)
tsconfig.build.json   # build: compila solo src/ a dist/ (npm run build)
eslint.config.js      # reglas de ESLint con typescript-eslint (npm run lint)
.prettierrc           # formato de Prettier (npm run format)
Dockerfile            # imagen en dos etapas: compila con tsc y publica solo dist/ y las dependencias de producción (usuario no root)
docker-compose.yml    # servicios api, db (PostgreSQL 17), migrar y redis (Redis 7)
.dockerignore         # archivos que no entran en la imagen (.env, node_modules, tests...)
```

## Lo que está aplicado

Resumen de todo lo que ya tiene el proyecto, con el enlace a su explicación:

| Área                 | Qué está hecho                                                                                                                                                                                          |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Arquitectura         | Capas separadas: router → controller → service → repository; errores con `AppError` y un único `errorHandler`                                                                                           |
| Autenticación        | Access token JWT (HS256) corto + refresh token con rotación y detección de robo en cookie `httpOnly`, contraseñas con bcrypt, login de tiempo constante ([ver](#sesiones-access-token-y-refresh-token)) |
| Autorización (RBAC)  | Roles `lector`, `bibliotecario` y `admin`; `authorize` en cada ruta y reglas de propiedad en los services ([ver](#rutas-protegidas-y-roles-rbac))                                                       |
| Auditoría            | Tabla `audit_log` de solo escritura: logins, sesiones, cambios de rol y borrados, escritos en la misma transacción que el cambio ([ver](#auditoría--auditoria))                                         |
| Rate limiting        | Límite por IP y por email en `/auth`, con `Retry-After` ([ver](#rate-limiting))                                                                                                                         |
| Headers y CORS       | helmet + lista de orígenes permitidos ([ver](#cors-y-headers-de-seguridad-cors_origins))                                                                                                                |
| IP real              | `trust proxy` configurable para que el límite por IP funcione detrás de un proxy ([ver](#ip-real-detrás-de-un-proxy-trust_proxy))                                                                       |
| Configuración        | Todas las variables se validan al arrancar; la app no sube con una configuración inválida ([ver](#instalación))                                                                                         |
| Logs                 | pino en JSON, `X-Request-Id` en cada respuesta, `Authorization` y `password` ocultos ([ver](#logs-log_level-y-x-request-id))                                                                            |
| Health y apagado     | `/health` y `/health/ready`, apagado ordenado con SIGTERM/SIGINT ([ver](#health-checks--health))                                                                                                        |
| Paginación           | Por offset en libros y usuarios, por cursor en préstamos ([ver](#paginación-de-get-libros))                                                                                                             |
| Integridad de datos  | Transacciones con `SELECT ... FOR UPDATE` al prestar y devolver, `CHECK` de stock, índice único parcial de préstamo activo                                                                              |
| Rendimiento          | Índices en las llaves foráneas e índice compuesto `(usuario_id, id)` para la paginación por cursor                                                                                                      |
| Pruebas              | `node:test` + Supertest contra una base aparte, incluida una prueba de concurrencia ([ver](#pruebas))                                                                                                   |
| TypeScript           | Modo estricto, entidades y roles tipados, `req.user` tipado, `tsc` en el build y en CI                                                                                                                  |
| Validación           | Esquemas de Zod en `src/schemas/`; los tipos de entrada se infieren del esquema                                                                                                                         |
| Integración continua | GitHub Actions en cada PR (lint, formato, tipos, build, imagen Docker y pruebas con PostgreSQL) y rama `main` protegida                                                                                 |
| Contenedores         | Dockerfile en dos etapas (compila y publica solo `dist/`), sin dependencias de desarrollo y con usuario no root, Compose con PostgreSQL 17 y healthchecks ([ver](#ejecución-con-docker))                |
| Calidad de código    | ESLint con `typescript-eslint`, Prettier y `npm run typecheck`                                                                                                                                          |

## Próximos pasos

- [x] Autenticación con JWT y bcrypt
- [x] Tests con Supertest
- [x] Docker Compose para levantar la API y PostgreSQL
- [x] Rate limiting en `/auth` y protección contra enumeración de usuarios
- [x] Roles y permisos (RBAC) con `lector`, `bibliotecario` y `admin`
- [x] Paginación en libros, usuarios y préstamos
- [x] helmet, CORS, logs con pino, health checks y apagado ordenado
- [x] ESLint y Prettier

### Fase 1: TypeScript y CI ✅

- [x] GitHub Actions: lint, formato, tipos, build, imagen Docker y pruebas con PostgreSQL en cada PR, con `main` protegida
- [x] Configurar TypeScript (`tsconfig.json`, build y `npm run dev` con `tsx`) y ESLint con `typescript-eslint`
- [x] Migrar por capas, de abajo hacia arriba: `utils` y `config` → `repositories` → `services` → `controllers` y `routes`
- [x] Tipar las entidades (`Autor`, `Libro`, `Usuario`, `Prestamo`), los roles y los resultados de las consultas de `pg`
- [x] Tipar `req.user` (id y rol) para que el RBAC no dependa de `any`
- [x] Dockerfile en dos etapas: compila y publica solo el resultado
- [x] Validación con Zod, con los tipos inferidos de los esquemas
- [x] Migrar los tests y los scripts de `db/` a TypeScript
- [x] Guardar los contadores del rate limiting en Redis (para varias instancias)
- [x] Access token corto + refresh token con rotación y cookie `httpOnly`
- [x] Tabla de auditoría (`audit_log`)

### Después

- [x] Evaluar un ORM (Drizzle o Prisma) frente al SQL a mano: experimento con Drizzle en el repositorio de autores, ver [docs/evaluacion-orm.md](docs/evaluacion-orm.md)
