import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { BarChart3, ChevronRight, FilePlus2, FolderOpen, ReceiptText, WalletCards } from 'lucide-react'
import { Contenido } from '@/components/layout/AppShell'
import { esAdmin, useSesion, veComisiones } from '@/lib/sesion'
import { cn } from '@/lib/utils'

function Acceso({ a, icono, titulo, detalle, color }: { a: string; icono: ReactNode; titulo: string; detalle: string; color: string }) {
  return (
    <Link
      to={a}
      className="group flex items-center gap-4 rounded-xl border border-line bg-surface p-4 transition-shadow hover:shadow-md"
    >
      <div className={cn('flex size-12 shrink-0 items-center justify-center rounded-xl [&_svg]:size-6', color)}>{icono}</div>
      <div className="min-w-0 flex-1">
        <div className="font-semibold">{titulo}</div>
        <div className="text-[13px] text-ink-soft">{detalle}</div>
      </div>
      <ChevronRight className="size-5 text-ink-soft transition-transform group-hover:translate-x-0.5" />
    </Link>
  )
}

export default function Inicio() {
  const sesion = useSesion()
  const u = sesion?.usuario
  const hora = new Date().getHours()
  const saludo = hora < 12 ? 'Buenos días' : hora < 19 ? 'Buenas tardes' : 'Buenas noches'

  return (
    <Contenido className="max-w-4xl">
      <div className="mb-6 rounded-2xl bg-gradient-to-r from-navy to-navy-dark p-6 text-white">
        <div className="text-[13px] font-semibold text-white/70">{saludo},</div>
        <div className="text-2xl font-bold">{u?.nombre_usuario || u?.apodo_usuario}</div>
        <div className="mt-1 text-[13px] text-white/70">¿Qué desea hacer hoy?</div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Acceso a="/polizas/nueva" icono={<FilePlus2 />} titulo="Nueva póliza" detalle="Digitar a mano o desde el PDF con IA" color="bg-green-soft text-green" />
        <Acceso a="/polizas" icono={<ReceiptText />} titulo="Pólizas" detalle="Buscar, editar y controlar vencimientos" color="bg-navy-soft text-navy" />
        <Acceso
          a="/catalogos"
          icono={<FolderOpen />}
          titulo="Catálogos"
          detalle={esAdmin(u) ? 'Clientes, asesores, aseguradoras, ramos, productos y más' : 'Clientes, aseguradoras, ramos y productos'}
          color="bg-green-soft text-green"
        />
        <Acceso a="/reportes" icono={<BarChart3 />} titulo="Reportes" detalle="Tablero y exportar a Excel" color="bg-navy-soft text-navy" />
        {veComisiones(u) && (
          <Acceso a="/comisiones" icono={<WalletCards />} titulo="Reportes de Comisiones" detalle="Registrar abonos y pagos de comisiones" color="bg-warning-soft text-warning" />
        )}
      </div>
    </Contenido>
  )
}
