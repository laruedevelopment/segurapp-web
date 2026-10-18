import { useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import { Pencil } from 'lucide-react'
import { Contenido, EncabezadoPagina } from '@/components/layout/AppShell'
import { Cargando, MensajeError, Vacio } from '@/components/ui/basicos'
import { Boton } from '@/components/ui/button'
import { Tabla, type Columna } from '@/components/ui/tabla'
import { obtenerCliente } from '@/datos/catalogos'
import { listarPolizasDeCliente } from '@/datos/polizas'
import { aFecha, fmtFecha } from '@/lib/fechas'
import { fmtDinero, fmtDoc } from '@/lib/numeros'
import type { PolizaLista } from '@/lib/tipos'
import { mensajeAmigable } from '@/lib/errores'
import { CLAVE_CLIENTES, claveCliente } from './clientesDatos'
import { BotonRecargar } from './comun'
import { DialogoCliente } from './DialogoCliente'

/** Todas las pólizas de un cliente (se abre con "Ver pólizas" en el catálogo de clientes). */
export default function PolizasCliente() {
  const navigate = useNavigate()
  const id = Number(useParams().id)
  const valido = Number.isInteger(id) && id > 0
  const [editando, setEditando] = useState(false)

  const cliente = useQuery({ queryKey: claveCliente(id), queryFn: () => obtenerCliente(id), enabled: valido })
  const polizas = useQuery({
    queryKey: [...CLAVE_CLIENTES, 'polizas', id],
    queryFn: () => listarPolizasDeCliente(id),
    enabled: valido,
    staleTime: 0,
  })

  const c = cliente.data
  const lista = polizas.data ?? []

  const columnas: Columna<PolizaLista>[] = [
    { id: 'id', titulo: 'Cód.', ancho: 70, alinear: 'der', celda: (p) => <span className="num">{p.id}</span>, ordenar: (p) => p.id },
    { id: 'nro', titulo: 'Nro. póliza', ancho: 170, celda: (p) => <span className="num font-semibold">{p.nro_poliza ?? '(sin número)'}</span>, ordenar: (p) => p.nro_poliza, titleDe: (p) => p.nro_poliza ?? undefined },
    { id: 'aseg', titulo: 'Aseguradora', ancho: 170, celda: (p) => p.nombre_aseg ?? '—', ordenar: (p) => p.nombre_aseg?.toLowerCase(), titleDe: (p) => p.nombre_aseg ?? undefined },
    {
      id: 'ramo',
      titulo: 'Ramo / Producto',
      ancho: 180,
      celda: (p) => (
        <div className="leading-tight">
          <div className="truncate font-medium">{p.nombre_ramo ?? '—'}</div>
          {p.nombre_prod && <div className="truncate text-[11.5px] text-ink-soft">{p.nombre_prod}</div>}
        </div>
      ),
      ordenar: (p) => p.nombre_ramo?.toLowerCase(),
      titleDe: (p) => [p.nombre_ramo, p.nombre_prod].filter(Boolean).join('\n'),
    },
    { id: 'bien', titulo: 'Bien asegurado', ancho: 190, celda: (p) => p.bien_asegurado ?? '', ordenar: (p) => p.bien_asegurado?.toLowerCase(), titleDe: (p) => p.bien_asegurado ?? undefined },
    { id: 'fini', titulo: 'F. inicio', ancho: 95, celda: (p) => <span className="num">{fmtFecha(aFecha(p.fini_poliza)) || '—'}</span>, ordenar: (p) => p.fini_poliza },
    { id: 'ffin', titulo: 'F. vence', ancho: 95, celda: (p) => <span className="num">{fmtFecha(aFecha(p.ffin_poliza)) || '—'}</span>, ordenar: (p) => p.ffin_poliza },
    { id: 'prima', titulo: 'V. prima', ancho: 120, alinear: 'der', celda: (p) => <span className="num">{p.prima_poliza ? fmtDinero(p.prima_poliza) : '—'}</span>, ordenar: (p) => p.prima_poliza },
    { id: 'asesor', titulo: 'Asesor', ancho: 140, celda: (p) => p.nombre_asesor ?? '—', ordenar: (p) => p.nombre_asesor?.toLowerCase(), titleDe: (p) => p.nombre_asesor ?? undefined },
  ]

  const doc = c?.doc_cliente ? `${c.tipodoc_cliente ? c.tipodoc_cliente + ' ' : ''}${fmtDoc(c.doc_cliente)}` : ''

  return (
    <div className="flex h-full flex-col">
      <EncabezadoPagina
        titulo={c ? `Pólizas de ${c.nombre_cliente}` : 'Pólizas del cliente'}
        subtitulo={
          polizas.isSuccess
            ? [`Cliente ${id}`, doc, `${lista.length} ${lista.length === 1 ? 'póliza' : 'pólizas'}`].filter(Boolean).join(' · ')
            : undefined
        }
        volver="/catalogos/clientes"
        acciones={
          <>
            <BotonRecargar
              onClick={() => Promise.all([polizas.refetch(), cliente.refetch()])}
              cargando={polizas.isFetching || cliente.isFetching}
            />
            {c && (
              <Boton variante="secundario" tamano="sm" onClick={() => setEditando(true)}>
                <Pencil />
                Editar cliente
              </Boton>
            )}
          </>
        }
      />
      <Contenido className="flex min-h-0 flex-1 flex-col gap-3">
        {!valido ? (
          <MensajeError error="El código de cliente no es válido." />
        ) : polizas.isError ? (
          <MensajeError error={mensajeAmigable(polizas.error, 'No se pudieron cargar las pólizas')} />
        ) : polizas.isPending ? (
          <Cargando texto="Cargando pólizas…" />
        ) : (
          <Tabla
            className="min-h-[280px] flex-1"
            filas={lista}
            columnas={columnas}
            clave={(p) => p.id}
            ordenInicial={{ columna: 'id', asc: false }}
            alHacerClic={(p) => navigate(`/polizas/${p.id}`)}
            vacio={<Vacio titulo="Este cliente no tiene pólizas registradas." />}
          />
        )}
      </Contenido>
      <DialogoCliente abierto={editando} clienteId={valido ? id : null} onCerrar={() => setEditando(false)} onGuardado={() => undefined} />
    </div>
  )
}
