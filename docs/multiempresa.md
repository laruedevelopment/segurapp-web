# SegurApp multiempresa — diseño técnico (borrador para decidir)

Meta: el mismo código sirve a varias agencias. Cada empresa tiene su propia base, su propio almacenamiento, su marca y sus módulos. Las mejoras (incluida la lectura con IA) llegan a todas a la vez. **Rueda Serrano no se interrumpe en ningún paso.**

## 1. Lo que hoy ata la app a una sola empresa

| Punto | Dónde | Qué hay que hacer |
|---|---|---|
| Una sola base, fijada al compilar | `src/lib/supabase.ts` lee `VITE_SUPABASE_URL` | Resolver la base al abrir la app (según la empresa) |
| Marca y datos fijos | "Rueda Serrano…" en `Login.tsx`, `AppShell.tsx`, `EstadoCuenta.tsx`, `comisiones/pdf.ts`; NIT y contacto en `facturas/pdfCuentaCobro.ts`; logo `logo.png` | Leerlos de la configuración de cada empresa |
| Valores por defecto del negocio | `Formulario.tsx`: asesor "LUZ STELLA SERRANO", forma de pago "CONTADO", intermediario "STELLA" | Configurables por empresa |
| Roles fijos A/S/D | RLS con `app_rol()` en toda la base, y `esAdmin`/`veComisiones` en 18 archivos del front | Roles y permisos editables (ver 4.2) |
| Funciones propias de Rueda Serrano | SOAT, todo riesgo, facturas de comisiones | Módulos que se activan por empresa |
| Edge Functions y claves | `login`, `extraer-poliza`, `extraer-reporte-pago`, con secretos por proyecto | Desplegar a todos los proyectos desde un script |

Lo que **ya** ayuda: el login es propio (apodo + clave, token firmado por la función `login`), no depende de Supabase Auth. Cada proyecto tiene su secreto y por eso es naturalmente independiente. También existen `consumo_ia` y el tope de IA por proyecto.

## 2. Arquitectura recomendada: un proyecto Supabase por empresa

```
                 ┌──────────────────────────┐
  Javier ───────►│ Proyecto MAESTRO         │  tabla empresas (slug, url, clave pública,
  (panel admin)  │ (solo lo usa Javier)     │  estado, plan, módulos), bitácora de despliegues
                 └────────────┬─────────────┘
                              │ scripts de aprovisionamiento y despliegue
        ┌─────────────────────┼──────────────────────┐
        ▼                     ▼                      ▼
  Proyecto Rueda Serrano   Proyecto Empresa B   Proyecto Empresa C
  (el de hoy, sin migrar)  (BD + Storage +      ...
                            Edge Functions)
```

- **Datos aislados:** si una empresa tiene un problema, no toca a las demás. Cada una puede pedir su copia o su baja sin riesgo para el resto. Esto también ayuda con la Ley 1581 (usted sería el encargado del tratamiento).
- **Rueda Serrano no se migra:** su proyecto actual sigue igual, y recibe las mismas migraciones que los demás.
- **Alternativa descartada:** una sola base con `empresa_id`. Es más barata, pero obliga a reescribir todas las políticas de seguridad (RLS) de producción, y un error mostraría datos de una empresa a otra.

## 3. Cómo sabe la app a qué empresa conectarse

Opciones, de menor a mayor esfuerzo:

1. **Una compilación por empresa** (lo que ya hicimos con `/pruebas/`): el flujo de despliegue recorre una lista de empresas y publica `/<slug>/`. Sin cambios en el código. Cada empresa lleva una carpeta en el mismo sitio. Sirve para los primeros 3 a 5 clientes.
2. **Una sola compilación, empresa por dirección** (subdominio `empresa.segurapp.co` o dirección propia): la app pide al arrancar un archivo público `empresa.json` (marca, URL y clave pública de su base, módulos). Requiere un hosting que reescriba rutas (Cloudflare Pages o Vercel, ambos gratuitos para esto) y un dominio. GitHub Pages no sirve para esto.

Recomendación: empezar con la opción 1 (rápida y sin riesgo) y diseñar el código ya como si fuera la 2: la marca y la base se leen de una sola configuración (`empresa.ts`). Pasar a la opción 2 después es un cambio pequeño.

## 4. Pasos

Cada paso es aditivo, se prueba primero en la copia de pruebas, y por defecto deja **exactamente** el comportamiento actual de Rueda Serrano.

### 4.0 Configuración por empresa (sin cambio visible)
- Tabla `config_empresa` en cada base (una fila): nombre, NIT, contacto, logo, colores, ciudad, valores por defecto del formulario (asesor, forma de pago, intermediario) y **módulos activos**.
- El front la lee al iniciar sesión (con valores de respaldo = los de Rueda Serrano si la tabla está vacía).
- Se reemplazan los textos fijos de la lista de la sección 1.
- Módulos con interruptor: `facturas`, `soat`, `vencimientos`, `todo_riesgo`, `oportunidades`, `ia_polizas`, `ia_reportes`.
- Prueba: nada cambia para Rueda Serrano; en pruebas se cambia la configuración y la app cambia de marca.

### 4.1 Selección de empresa al abrir la app
- `empresa.ts`: resuelve slug → (URL, clave pública, marca) y construye el cliente de la base.
- Flujo de despliegue por lista de empresas (opción 1 de la sección 3).

### 4.2 Roles y permisos editables
La parte más delicada, porque la seguridad de la base depende de los roles:
- Cada rol propio de una empresa tiene un **rol base** (A, S o D) del que hereda la seguridad de la base. **Las políticas RLS no se reescriben**: siguen valiendo para A/S/D.
- Sobre eso, tablas `roles` y `rol_permisos(rol, permiso)`: qué pantallas ve cada rol. El front usa `puede('facturas')` en vez de `esAdmin` y `veComisiones`.
- Roles por defecto sembrados idénticos a los de hoy. Los administradores de cada empresa los editan desde una pantalla "Roles y permisos".
- Una pantalla oculta no es seguridad: lo que protege es el rol base en la base de datos. Está bien documentarlo así al cliente.

### 4.3 Panel maestro (solo Javier) y aprovisionamiento
- Proyecto Supabase "maestro" con la tabla `empresas` y su panel (activar, suspender, módulos, plan, contacto).
- Script `provisionar` (con la API de administración de Supabase y un token que solo vive en el servidor): crea el proyecto, aplica todas las migraciones, despliega las Edge Functions, fija los secretos, siembra la configuración y crea el primer administrador. Primero se ejecuta desde la línea de comandos; el botón del panel viene después.
- Costos: cada proyecto en plan gratuito se **pausa tras 7 días sin uso**. Para clientes de pago se necesita el plan Pro (unos 25 USD por proyecto al mes), que debe estar en el precio.

### 4.4 Despliegue para todas las empresas
- Tabla `version_esquema` en cada base y script `desplegar-todo`: aplica migraciones y funciones a pruebas primero, luego a cada empresa, y se detiene si algo falla. Muestra un resumen por empresa.
- Mismas migraciones y mismo código para todas: así las mejoras de IA y de optimización llegan a todos.

### 4.5 IA compartida
- Una sola clave de Gemini para todas (más barato) o una por empresa (más claro para cobrar). `consumo_ia` ya registra por proyecto, y el tope de IA ya existe. Decidir quién paga el consumo.

## 5. Reglas para no afectar a Rueda Serrano
1. Todo cambio de base es aditivo (tablas y columnas nuevas, nada se borra ni se renombra).
2. Se aplica primero en pruebas; en producción solo con su visto bueno y, si hay riesgo, de noche.
3. Todo módulo nuevo nace oculto en producción y se enciende con su configuración.
4. Antes de cada publicación se corren las pruebas en PowerShell y se comprueba el sitio en vivo.
5. Los archivos de versiones anteriores se conservan 21 días, para que nadie vea errores al publicar.

## 6. Decisiones pendientes
1. ¿Un proyecto Supabase por empresa (recomendado) y no una base compartida?
2. ¿Empezamos con una compilación por empresa en este mismo sitio, o ya con dominio propio?
3. ¿Quién paga la IA y el plan de Supabase de cada cliente?
4. ¿Qué módulos de hoy son exclusivos de Rueda Serrano y cuáles van a todos?
