# Demo de SegurApp con datos ficticios

El **modo demo** compila la app con una base de datos inventada que vive en el navegador (`src/demo/`):
no se conecta a ninguna base real. Sirve para grabar el video y para mostrar la app sin riesgo.

## Generar el video (unos 4 minutos, sin intervención)

```
npm run demo:build     # compila la app en dist-demo/ con la base ficticia
npm run demo:video     # graba demo-video/SegurApp_demo.mp4 (con subtítulos y voz)
```

- La voz es la de Windows (*Microsoft Helena*, español). Con `SIN_VOZ=1` se graba solo con subtítulos.
- Requiere Google Chrome instalado y `ffmpeg` (`python -m pip install imageio-ffmpeg`).
- El guion está en `scripts/demo/grabar.mjs` (lista `guion`: cada paso tiene su narración y sus clics).
- `npm run demo:revisar` toma una foto de cada pantalla y lista los errores de consola.

## Cambiar los datos

Todo está en `src/demo/datos.ts` (clientes, pólizas, pagos, reportes, facturas, metas). Las fechas se
calculan a partir del día de hoy, así el semáforo de vencimientos siempre se ve variado.

## Producción no cambia

Las compilaciones normales no incluyen nada del demo (se activa solo con `VITE_DEMO=1`, en `.env.demo`).
