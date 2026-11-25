# Roles y permisos parametrizables — diseño (para aprobar)

Necesidad: que el CRM muestre a cada asesor **solo sus clientes**, que un administrador o gerente vea todos, y que se puedan **crear roles nuevos** con permisos distintos, sin programar cada vez.

## 1. Situación actual (verificada en el código)
- Hay 3 roles fijos de una letra: **A** administrador, **S** comisiones, **D** digitador (`lib/sesion.ts`).
- El front decide con `esAdmin` y `veComisiones` (18 archivos).
- En la base, casi todas las políticas solo exigen `app_rol() is not null` (cualquier usuario activo ve y escribe todo). Solo la eliminación de pólizas y las facturas distinguen el rol. Esto facilita el cambio: hay pocos puntos que tocar.

## 2. Modelo propuesto

```
roles
  codigo   text pk          -- 'A', 'S', 'D' y los nuevos: 'G' (gerente), 'AS' (asesor)...
  nombre   text
  nivel    int              -- jerarquía: 100 admin, 80 gerente, 50 coordinador, 10 asesor
  rol_base text             -- 'A' | 'S' | 'D': de quién hereda la seguridad de la base (RLS sin reescribir)
  ve_todo  boolean          -- ve los clientes de todos (admin, gerente) o solo los suyos
  activo   boolean

rol_permisos (rol, permiso)  -- qué puede hacer cada rol
```
Y en `usuarios`: `jefe_id` (opcional), para que un coordinador vea los clientes de su equipo.

### Permisos (lista inicial, se amplía con cada módulo)
| Permiso | Para qué |
|---|---|
| `clientes.ver_todos` | Ver los clientes de todos los asesores |
| `clientes.ver_equipo` | Ver los suyos y los de quienes dependen de él |
| `clientes.reasignar` | Cambiar el asesor de un cliente |
| `actividades.asignar` | Asignar tareas a otros usuarios (solo de su alcance) |
| `actividades.anular_ajenas` | Anular actividades de otros |
| `notas.ver` | Ver las notas de gestión |
| `comisiones.ver`, `facturas.ver` | Módulos que hoy controla `veComisiones` |
| `tablero.ver`, `dashboard.ver` | Tableros gerenciales |
| `polizas.eliminar_autorizar` | Autorizar eliminaciones |
| `usuarios.administrar`, `roles.administrar` | Gestión de usuarios y roles |

### Cómo se aplica "solo los suyos"
Una función de base `puede(permiso)` y otra `clientes_visibles()`:
- Si el rol tiene `ve_todo` → todos.
- Si tiene `ver_equipo` → sus clientes y los de su equipo (`jefe_id`, recursivo).
- Si no → solo `clientes.asesor_id` = su asesor.

La RLS de `cliente_actividades` (y más adelante las vistas del CRM) usa esa función. **Las pólizas y los clientes de hoy no cambian de política en esta fase**: el filtro "solo los suyos" empieza en el CRM (ficha, actividades, pendientes). Restringir además el catálogo de clientes y las pólizas es un paso aparte, con su propia prueba, porque afecta el trabajo diario.

### Seguridad
Ocultar una pantalla no es seguridad; la protege la base. Por eso:
- Cada rol propio tiene un **rol base** (A/S/D) del que hereda lo que hoy permiten las políticas existentes.
- Los permisos nuevos se validan **también** en las funciones de la base (`puede('...')`), no solo en el front.
- Cambios de rol y de permisos quedan en una bitácora (quién, cuándo, qué).

## 3. Pantalla "Roles y permisos" (solo `roles.administrar`)
- Lista de roles con su nivel y rol base.
- Casillas de permisos por rol, agrupadas por módulo.
- Crear rol nuevo copiando uno existente.
- En Usuarios: asignar rol, jefe y asesor vinculado.
- Aviso al quitar un permiso: "N usuarios lo perderán".

## 4. Cómo no afectar a producción
1. Migración aditiva: tablas `roles`, `rol_permisos`, columna `usuarios.jefe_id`. Se siembran A, S, D con **exactamente** los permisos de hoy.
2. El front mantiene `esAdmin` / `veComisiones` como están y los reemplazamos por `puede(...)` módulo por módulo, cada uno probado.
3. Si la tabla de permisos está vacía o falla la carga, la app cae al comportamiento actual (A/S/D).
4. Primero en pruebas; producción solo con su visto bueno y de noche.
5. Esto es el paso 4.2 del diseño multiempresa: se hace una sola vez y sirve para todas las empresas.

## 5. Orden
| Paso | Entrega |
|---|---|
| 1 | Ficha 360° del cliente (solo lectura, sin cambio de base) |
| 2 | Migración de roles y permisos en pruebas + función `puede()` |
| 3 | Actividades del CRM con visibilidad por alcance (`clientes_visibles()`) |
| 4 | Pantalla Roles y permisos + Usuarios con jefe |
| 5 | "Mis pendientes" y tarjeta en Inicio |
| 6 | Reemplazo gradual de `esAdmin` por `puede()` en el resto de módulos |

## 6. Decisiones pendientes
1. Roles de ejemplo para sembrar: ¿**Gerente** (ve todo), **Coordinador** (ve su equipo) y **Asesor** (ve lo suyo)? ¿Otros?
2. ¿Cada usuario está vinculado a un asesor del catálogo? (Hoy `clientes.asesor_id` apunta a `asesores`, no a `usuarios`.)
3. ¿Los clientes sin asesor asignado los ve solo el administrador/gerente?
4. ~~¿Las notas de gestión las ve el digitador?~~ **Decidido: sí** (permiso `notas.ver` sembrado para A, S y D).

Decididas por Javier: cada asesor ve solo sus clientes salvo roles con alcance mayor (admin, gerente); asignar tareas lo hace el administrador u otro rol con jerarquía; los roles y permisos deben ser parametrizables.
