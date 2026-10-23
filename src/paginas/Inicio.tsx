import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { BarChart3, ChevronRight, ClipboardCheck, FilePlus2, Target, FolderOpen, LayoutDashboard, ReceiptText, Trash2, WalletCards } from 'lucide-react'
import { Contenido } from '@/components/layout/AppShell'
import { useCasosPendientes } from '@/datos/casos'
import { useConteoEliminaciones } from '@/datos/eliminacion'
import { ES_PRUEBAS } from '@/lib/supabase'
import { esAdmin, useSesion, veComisiones } from '@/lib/sesion'
import { cn } from '@/lib/utils'

function Acceso({ a, icono, titulo, detalle, color, contador }: { a: string; icono: ReactNode; titulo: string; detalle: string; color: string; contador?: number }) {
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
      {(contador ?? 0) > 0 && (
        <span className="rounded-full bg-warning-soft px-2.5 py-0.5 text-xs font-semibold text-warning-ink">
          <span aria-hidden="true">{contador}</span>
          <span className="sr-only">{contador === 1 ? '1 pendiente' : `${contador} pendientes`}</span>
        </span>
      )}
      <ChevronRight className="size-5 text-ink-soft transition-transform group-hover:translate-x-0.5" />
    </Link>
  )
}

export default function Inicio() {
  const sesion = useSesion()
  const u = sesion?.usuario
  const hora = new Date().getHours()
  const casos = useCasosPendientes()
  const eliminaciones = useConteoEliminaciones()
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
        <Acceso
          a="/casos"
          icono={<ClipboardCheck />}
          titulo="Casos por revisar"
          detalle="Pagos, pólizas o comisiones dudosas que hay que aclarar"
          color="bg-warning-soft text-warning"
          contador={casos.data}
        />
        {veComisiones(u) && (
          <Acceso a="/comisiones" icono={<WalletCards />} titulo="Reportes de Comisiones" detalle="Registrar abonos y pagos de comisiones" color="bg-warning-soft text-warning" />
        )}
        {ES_PRUEBAS && (
          <Acceso a="/oportunidades" icono={<Target />} titulo="Oportunidades SECOP" detalle="Contratos públicos nuevos: posibles clientes de pólizas" color="bg-green-soft text-green" />
        )}
        {esAdmin(u) && (
          <Acceso a="/dashboard" icono={<LayoutDashboard />} titulo="Dashboard gerencial" detalle="Producción, cartera, renovaciones y metas" color="bg-green-soft text-green" />
        )}
        {esAdmin(u) && (
          <Acceso
            a="/polizas/eliminaciones"
            icono={<Trash2 />}
            titulo="Eliminaciones por autorizar"
            detalle="Pólizas que pidieron eliminar: decida si se borran o vuelven"
            color="bg-danger-soft text-danger"
            contador={eliminaciones.data}
          />
        )}
      </div>
    </Contenido>
  )
}
