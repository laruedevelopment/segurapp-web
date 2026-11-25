# SegurApp CRM — diseño de las capas 1 y 2 (para aprobar)

Meta: que el personal gestione la **relación** con el cliente, no solo la póliza. Todo es aditivo: tablas nuevas, nada de lo actual cambia, y nace **oculto en producción** (solo pruebas) hasta su visto bueno.

## 1. Qué ya existe y se reutiliza
- `clientes`: nombre, documento, teléfono, correo, dirección, municipio, contacto y cargo, asesor, `notas_cliente`.
- `polizas` + `vw_polizas_busqueda`: vigencias, anexos, prima, valor, placas.
- `seguimientos_renovacion` y su historial: el seguimiento de vencimientos (estados P, C, R, F, N).
- `abonos_poliza`: pagos y comisiones. `usuarios` con roles A / S / D y `app_rol()` / `app_usuario_id()`.

## 2. Capa 1 — Ficha 360° del cliente (solo lectura, sin tablas nuevas)
Ruta `/clientes/:id`. Se abre desde Catálogos → Clientes y desde cualquier póliza (clic en el nombre).

Bloques:
1. **Encabezado:** nombre, documento, asesor, teléfono y correo con botones de llamar, WhatsApp y correo.
2. **Cifras:** pólizas vigentes, prima y valor vigentes, pólizas vencidas, años como cliente, cartera pendiente, comisión generada (esta última solo administrador y comisiones).
3. **Pólizas:** vigentes primero, con las vigencias y anexos agrupados (reutiliza `colapsarAnexos`) y las placas.
4. **Cobertura por ramo:** qué ramos tiene y cuáles no (venta cruzada). Primera versión: lista de ramos con marca "tiene / no tiene".
5. **Línea de tiempo:** mezcla en orden cronológico las pólizas expedidas y renovadas, los pagos, los seguimientos de renovación y (capa 2) las notas y llamadas.

Datos: una consulta por cliente a `vw_polizas_busqueda` y `abonos_poliza`. No se necesita migración.

## 3. Capa 2 — Actividades y seguimiento general

### Tablas (migración aditiva)
```
cliente_actividades
  id bigint identity pk
  cliente_id bigint not null -> clientes(id)
  poliza_id  bigint null     -> polizas(id)       -- si la actividad es sobre una póliza
  tipo text not null         -- 'N' nota, 'L' llamada, 'W' WhatsApp, 'C' correo, 'V' visita, 'T' tarea
  asunto text not null (máx. 120)
  detalle text null (máx. 1000)
  estado text not null       -- 'H' hecha, 'P' pendiente (las tareas nacen P)
  vence date null            -- próximo contacto / fecha límite de la tarea
  asignado_a bigint null     -- usuario responsable
  creado_por bigint, fcreado timestamptz
  cerrado_por bigint null, fcerrado timestamptz null
```
- Índices: `(cliente_id, fcreado desc)` y `(asignado_a, estado, vence)`.
- RLS: lectura para cualquier rol; escritura **solo por RPC** `actividad_guardar` y `actividad_cerrar` (security definer, validan tipo, estado y largos, y registran quién). Mismo patrón que los seguimientos.
- **Nada se borra:** una actividad errónea se anula con estado 'X' (queda el rastro). Solo el administrador anula las ajenas.

### Pantallas
1. **En la ficha 360°:** botón "Registrar actividad" (tipo, asunto, detalle, próximo contacto opcional) y la línea de tiempo.
2. **"Mis pendientes"** `/pendientes`: lo asignado al usuario, agrupado en vencidas, hoy, esta semana y sin fecha. Marcar como hecha con un clic. El administrador puede ver las de todos y filtrar por asesor.
3. **Inicio:** tarjeta con el número de pendientes de hoy y vencidos (mismo estilo que Vencimientos).
4. **Vencimientos:** al marcar un seguimiento con nota, se refleja también en la línea de tiempo del cliente (solo lectura, sin duplicar datos).

### Permisos (decisión pendiente, abajo)
Por defecto: todos ven y registran sobre todos los clientes (como hoy con las pólizas). Se puede restringir a "cada asesor ve lo suyo" después, porque la RLS se ajusta en un solo lugar.

## 4. Protección de datos (Ley 1581)
- Solo se guardan datos de trabajo (notas de gestión). Sin datos sensibles de salud en las notas: aviso en el formulario.
- Quién registró y cuándo queda siempre.
- Fase posterior: campo "autoriza contacto por WhatsApp / correo" en el cliente, antes de cualquier envío masivo.

## 5. Orden de construcción
| Paso | Entrega | Riesgo |
|---|---|---|
| 1 | Ficha 360° (solo lectura) en pruebas | Ninguno: no toca la base |
| 2 | Migración `cliente_actividades` en pruebas + registrar actividad | Bajo (tabla nueva) |
| 3 | "Mis pendientes" + tarjeta en Inicio | Bajo |
| 4 | Revisión suya en pruebas → ajustes | — |
| 5 | Migración y publicación en producción (de noche, con su visto bueno) | Bajo |

Cada paso: pruebas en PowerShell, `ES_PRUEBAS` y verificación del sitio antes de avisarle.

## 6. Decisiones que necesito de usted
1. ¿Cada asesor ve **todos** los clientes o solo los suyos?
2. ¿Quién puede asignar tareas a otros: solo administrador, o cualquiera?
3. ¿Las notas de un cliente las ve el rol digitador (D) o solo A y S?
4. ¿Empiezo ya con el paso 1 (ficha 360°)? No requiere nada de su parte.
