# Actualizar la base de PRUEBAS con los datos de PRODUCCIÓN

`sincronizar.mjs` copia los **datos** de producción a pruebas, para que pruebas quede como producción hoy.

**Qué hace**
- **Producción solo se lee** (transacción de solo lectura, con una foto consistente).
- **Pruebas se sobrescribe:** se vacían las tablas copiadas y se vuelven a llenar con los datos de producción.
- Se **conservan** las tablas y columnas que solo existen en pruebas (migraciones aún no aplicadas en producción);
  esas columnas quedan vacías (por ejemplo `origen` de las pólizas).
- **No se copian** `consumo_ia`, `consumo_precios`, `consumo_config`, `ia_uso`, `config_empresa` ni los seguimientos de
  renovación: son propios de cada ambiente. Los seguimientos de pruebas **se vacían**, porque dependen de las pólizas.
- Los **usuarios se copian con sus claves de producción**: después, en pruebas, cada usuario entra con su clave de producción
  (incluido JAVIER).
- **No** copia archivos de Storage ni los usuarios de Supabase Auth (la app usa su propio login).
- Candados: se detiene si las dos bases no son las esperadas, si producción parece vacía (seguridad por filas), y si algo
  falla a la mitad pruebas queda como estaba. Pide escribir `SOBRESCRIBIR PRUEBAS` antes de borrar nada.

## Pasos

1. **Cadenas de conexión** (Supabase → cada proyecto → botón *Connect* → *Session pooler* → URI; reemplace `[YOUR-PASSWORD]`).
   Para producción use el usuario `postgres` (se salta la seguridad por filas; si no, la copia vería las tablas vacías).
   Si no recuerda la clave de la base, se restablece en *Project Settings → Database*. **No la pegue en el chat.**
2. En PowerShell, en la carpeta del proyecto (las claves quedan solo en esa ventana, no en ningún archivo):

```powershell
$env:PROD_DB_URL    = 'postgresql://postgres.tmuapctazakdecyddelw:CLAVE@aws-0-XXXX.pooler.supabase.com:5432/postgres'
$env:PRUEBAS_DB_URL = 'postgresql://postgres.oodwizkzcjqrtjyiipew:CLAVE@aws-0-XXXX.pooler.supabase.com:5432/postgres'
node scripts/sync-pruebas/sincronizar.mjs            # ENSAYO: solo muestra las filas de cada tabla; no cambia nada
node scripts/sync-pruebas/sincronizar.mjs --aplicar  # copia de verdad (pide confirmación escrita)
```

3. Al terminar verifica que cada tabla tenga las mismas filas en las dos bases. Cierre la ventana de PowerShell
   (o `Remove-Item Env:PROD_DB_URL, Env:PRUEBAS_DB_URL`).

Si tras copiar quiere volver a probar lo que solo existe en pruebas (por ejemplo, el origen de las pólizas o los
seguimientos), esos datos se pierden: es lo esperado, pruebas vuelve a ser una copia de producción.

## Probar el propio script
`probar.mjs` lo prueba contra dos bases de Postgres desechables (29 comprobaciones). Ver el encabezado del archivo.
