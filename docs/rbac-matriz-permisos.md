# biblioteca-API: matriz de permisos (PR #2 `feat/rbac`)

Acordada el 2026-11-15 a partir de la propuesta inicial y del análisis del desarrollador, que corrigió 4 puntos con criterio de negocio.

Roles: `lector` (por defecto, mínimo privilegio) · `bibliotecario` · `admin`

| Acción | Endpoint | lector | bibliotecario | admin |
|---|---|---|---|---|
| Registrarse | `POST /auth/registrar` | público, **siempre queda como lector** (el `rol` del body se ignora) | — | — |
| Ver libros y autores | `GET /libros`, `GET /autores` | ✅ público | ✅ | ✅ |
| Crear/editar libros y autores, cambiar stock | `POST/PUT /libros`, `PATCH /libros/:id/stock`, `POST/PUT /autores` | ❌ | ✅ | ✅ |
| Borrar libros y autores | `DELETE /libros/:id`, `DELETE /autores/:id` | ❌ | ❌ | ✅ (acción destructiva) |
| Pedir un préstamo | `POST /prestamos` | ✅ siempre a su nombre (se ignora `usuarioId`) | ✅ puede enviar `usuarioId` | ✅ puede enviar `usuarioId` |
| Ver préstamos | `GET /prestamos`, `GET /prestamos/:id` | solo los suyos | todos | todos |
| Devolver un préstamo | `PATCH /prestamos/:id/devolver` | ❌ (se registra en el mostrador) | ✅ cualquiera | ✅ cualquiera |
| Listar usuarios | `GET /usuarios` | ❌ | ✅ solo lectura | ✅ |
| Ver un usuario | `GET /usuarios/:id` | solo a sí mismo | ✅ | ✅ |
| Editar un usuario | `PUT /usuarios/:id` | solo a sí mismo | solo a sí mismo | cualquiera |
| Borrar un usuario | `DELETE /usuarios/:id` | solo a sí mismo | solo a sí mismo | cualquiera **menos a sí mismo** |
| Cambiar el rol de alguien | `PATCH /usuarios/:id/rol` (nuevo) | ❌ | ❌ | ✅ pero **no puede quitarse el rol a sí mismo** |

Códigos de error: sin token o con token inválido → `401`; rol no permitido o recurso ajeno → `403 PERMISO_DENEGADO`; admin que intenta borrarse o degradarse → `400`.

## Decisiones y su justificación
- **El lector no devuelve préstamos:** si pudiera, marcaría como devuelto un libro que sigue en su casa, el stock subiría y el sistema prestaría un ejemplar inexistente.
- **El bibliotecario lista usuarios (solo lectura):** lo necesita para atender en el mostrador. El riesgo es bajo porque la API nunca devuelve el password.
- **El bibliotecario presta a nombre de otros:** refleja el flujo real del mostrador. Si el lector envía un `usuarioId`, se ignora (protección contra mass assignment/IDOR).
- **Borrar es solo de admin:** es destructivo y poco frecuente. `ON DELETE RESTRICT` ya protege los libros que tienen préstamos.
- **Primer admin:** se crea con un `UPDATE` directo en la base de datos, nunca desde la API.
- **Prevención de auto-bloqueo:** un admin no puede quitarse el rol ni borrarse a sí mismo. Quien borra o degrada a otro sigue siendo admin, así que siempre queda al menos uno. Se eligió en lugar de contar admins (consulta extra y condición de carrera) y de aceptar el riesgo (evitarlo cuesta una línea).
- **Dónde se aplica cada regla:** la ruta (`authorize`) decide qué roles pueden llamar al endpoint; el servicio decide "solo a sí mismo / solo los suyos", porque depende del registro que se pide.

## Limitaciones conocidas
- **El rol vive en el JWT:** un cambio de rol se aplica cuando el usuario vuelve a iniciar sesión o cuando su token vence. Hasta entonces conserva los permisos anteriores.
- **Casos que pueden dejar el sistema sin admins:** un admin degradado que usa un token todavía vigente, o dos admins que se degradan al mismo tiempo. Se recupera con el mismo `UPDATE` directo que crea el primer admin.

## Estado
1. ✅ Migración `001_agregar_rol_usuarios.sql` + `schema.sql` actualizado
2. ✅ `rol` en el JWT (`sub`, `rol`) + middleware `authorize(...roles)` en todas las rutas
3. ✅ Reglas de propiedad (préstamos, usuarios) + `PATCH /usuarios/:id/rol` + prevención de auto-bloqueo
4. ✅ Tests por rol (63 en verde)
