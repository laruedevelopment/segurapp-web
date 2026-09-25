import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { BadgeCheck, ChevronRight, CreditCard, FileText, Landmark, LayoutGrid, Package, UserCog, Users } from 'lucide-react'
import { Contenido, EncabezadoPagina } from '@/components/layout/AppShell'
import { esAdmin, useSesion } from '@/lib/sesion'

interface ItemCatalogo {
  a: string
  titulo: string
  detalle: string
  icono: ReactNode
  soloAdmin?: boolean
}

const ITEMS: ItemCatalogo[] = [
  { a: 'clientes', titulo: 'Clientes', detalle: 'Personas y empresas aseguradas', icono: <Users /> },
  { a: 'aseguradoras', titulo: 'Aseguradoras', detalle: 'Compañías de seguros', icono: <Landmark /> },
  { a: 'ramos', titulo: 'Ramos', detalle: 'Líneas de negocio', icono: <LayoutGrid /> },
  { a: 'productos', titulo: 'Productos', detalle: 'Planes y coberturas por ramo', icono: <Package /> },
  { a: 'asesores', titulo: 'Asesores', detalle: 'Corredores, agentes y agencias', icono: <BadgeCheck />, soloAdmin: true },
  { a: 'formas-pago', titulo: 'Formas de pago', detalle: 'Cuotas y modalidades de pago', icono: <CreditCard />, soloAdmin: true },
  { a: 'formas-expedicion', titulo: 'Formas de expedición', detalle: 'Tipos de expedición de pólizas', icono: <FileText />, soloAdmin: true },
  { a: 'usuarios', titulo: 'Usuarios', detalle: 'Cuentas de acceso y roles', icono: <UserCog />, soloAdmin: true },
]

/** Menú de catálogos: el digitador ve Clientes, Aseguradoras, Ramos y Productos; el administrador, todos. */
export default function Catalogos() {
  const admin = esAdmin(useSesion()?.usuario)
  const items = ITEMS.filter((i) => admin || !i.soloAdmin)

  return (
    <>
      <EncabezadoPagina titulo="Catálogos" subtitulo="Datos base que usan las pólizas" />
      <Contenido className="max-w-4xl">
        <div className="grid gap-3 sm:grid-cols-2">
          {items.map((i) => (
            <Link
              key={i.a}
              to={`/catalogos/${i.a}`}
              className="group flex items-center gap-4 rounded-xl border border-line bg-surface p-4 transition-colors hover:border-navy/40 hover:bg-navy-soft/30"
            >
              <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-navy-soft text-navy [&_svg]:size-5">
                {i.icono}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-semibold">{i.titulo}</span>
                <span className="block text-[13px] text-ink-soft">{i.detalle}</span>
              </span>
              <ChevronRight className="size-5 text-ink-soft transition-transform group-hover:translate-x-0.5" />
            </Link>
          ))}
        </div>
      </Contenido>
    </>
  )
}
