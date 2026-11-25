# Evaluación de un ORM (PR 6)

**Pregunta:** ¿vale la pena cambiar el SQL a mano (`pg`) por un ORM en esta API, teniendo en cuenta que lo que más
importa es la **seguridad de los tipos**?

**Experimento:** un solo repositorio (`autores_repositories.ts`) reescrito con **Drizzle ORM** sobre el `Pool` de `pg`
que ya existe. Los demás repositorios no se tocan. Las firmas exportadas son idénticas, así que servicios, controladores
y tests de HTTP no cambian.

## Por qué Drizzle y no Prisma 7

| Criterio                      | Drizzle (sobre `Pool` de `pg`)                     | Prisma 7                                                            |
| ----------------------------- | -------------------------------------------------- | ------------------------------------------------------------------- |
| Reutiliza el `Pool` existente | Sí: `drizzle({ client: pool })`                    | No directamente: cliente propio con `@prisma/adapter-pg`            |
| Paso de generación            | Ninguno: los tipos salen del código TypeScript     | `prisma generate` (cliente generado en `generated/prisma`)          |
| Migraciones                   | Opcionales (`drizzle-kit`); el runner propio sigue | Motor propio: choca con el runner de checksums y advisory lock      |
| Defaults de conexión          | Los de `pg`, que ya configuras                     | Con el adaptador cambian (p. ej. `pg` no tiene timeout por defecto) |
| Versión estable               | 0.x estable; 1.0 aún en release candidate          | 7.x estable                                                         |

Prisma obligaría a mover o duplicar el sistema de migraciones. Drizzle encaja con lo que ya hay, y por eso es la
opción menos invasiva para evaluar.

## Qué se cambió

- `src/orm/esquema.ts`: la tabla `autores` descrita en TypeScript (solo para tipos; no crea nada).
- `src/orm/cliente.ts`: `db = drizzle({ client: pool })`.
- `src/repositories/autores_repositories.ts`: las 5 funciones con el constructor de consultas.
- `src/middlewares/errorHandler.ts`: desenvuelve `err.cause` (ver "Hallazgos", punto 3).
- `tests/autores.test.ts`: de 1 test a 6, incluyendo el 409 por FK.

## Hallazgos

1. **El tipo sale del esquema, no de una promesa.** Antes, `pool.query<Autor>()` solo _afirma_ el tipo. Ahora el tipo
   de la fila se infiere de la definición de la tabla y el compilador comprueba que coincide con `Autor` (el tipo de
   retorno de cada función lo exige). Un `.where(eq(autores.idd, 1))` con la columna mal escrita no compila; con SQL en
   un string, el error aparece en ejecución.
2. **Pero hay dos fuentes de verdad.** La tabla real la definen las migraciones; `esquema.ts` es una copia a mano. Si
   una migración renombra una columna y nadie edita `esquema.ts`, TypeScript sigue feliz y falla en ejecución. Es el mismo
   problema que ya existe con `Autor`, solo que movido de sitio. Mitigación posible: `drizzle-kit pull` en CI para
   comparar (no incluido en este PR; no se ha probado aquí).
3. **Los errores llegan envueltos.** `errorHandler` decide el 409 leyendo `err.code` (23503, 23505). Las versiones
   recientes de Drizzle envuelven el error de `pg` y dejan el original en `err.cause`. Sin ajuste, borrar un autor con
   libros habría dado 500 en vez de 409. Se añadió `errorDePg()` y un test que lo cubre. Esto es un coste real: cada
   capa nueva puede cambiar la forma de los errores.
4. **Las columnas internas se omiten a propósito.** `updated_at` no está en `esquema.ts`, así que `select()` no lo
   devuelve. Es cómodo, pero es una decisión implícita: quien añada la columna al esquema la expondrá en la API.
   La versión con SQL a mano lo hacía explícito con `COLUMNAS`.
5. **Las consultas simples quedan igual de claras.** El CRUD de autores es igual de legible, y algo más corto.
6. **Lo difícil no se probó.** `cambiarRol` (CTE con `FOR UPDATE` que devuelve el rol anterior), la rotación de refresh
   tokens y `COUNT(*) OVER()` en las paginaciones. Drizzle permite SQL crudo con `sql\`...\``, pero entonces se pierde
   justo la seguridad de tipos que se buscaba: el tipo del resultado volvería a ser una afirmación.
7. **Transacciones.** `enTransaccion` entrega un `PoolClient`. Para usar Drizzle dentro habría que envolverlo:
   `drizzle({ client: client })` por transacción, o migrar `enTransaccion` a `db.transaction()`. No se necesitó en
   autores, pero es el primer problema al migrar `usuarios` o `sesiones`.

## Cómo verificar (nada de esto lo ejecuté yo)

```bash
git switch -c feat/evaluacion-orm
npm install drizzle-orm
npm run typecheck && npm run lint && npm run format:check
npm test
```

Si `typecheck` falla en `esquema.ts` o `autores_repositories.ts`, es la primera señal de que la API de la versión
instalada difiere de la que se usó al escribirlo. Revisa la versión con `npm ls drizzle-orm`.

## Decisión sugerida

No migrar todo. El beneficio (tipos inferidos y consultas comprobadas) es real en el CRUD simple, que es la parte con
menos riesgo. El coste (doble definición del esquema, errores envueltos, SQL crudo donde más importa) se concentra
justo en las consultas que más importan. Una opción intermedia: dejar el SQL a mano y generar los tipos desde la base
(`drizzle-kit pull` o un generador de tipos) para eliminar el `Autor` escrito a mano sin cambiar las consultas.
La decisión final es tuya tras correr el experimento.
