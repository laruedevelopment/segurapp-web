import { useState, type ReactNode } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router'
import { Dialog } from 'radix-ui'
import { BarChart3, ClipboardCheck, FolderOpen, Home, LayoutDashboard, LogOut, Target, Menu, PanelLeftClose, PanelLeftOpen, ReceiptText, Trash2, WalletCards, X } from 'lucide-react'
import { useCasosPendientes } from '@/datos/casos'
import { useConteoEliminaciones } from '@/datos/eliminacion'
import { cerrarSesion, esAdmin, useSesion, veComisiones } from '@/lib/sesion'
import { ES_PRUEBAS } from '@/lib/supabase'
import { cn } from '@/lib/utils'

interface ItemMenu {
  a: string
  texto: string
  icono: ReactNode
  visible?: boolean
  /** Insignia de pendientes (no se muestra si es 0 o no hay dato). */
  contador?: number
  /** Rutas que no cuentan como "dentro" de este ítem (por ser otro ítem del menú). */
  excluir?: string
}

const CLAVE_MENU = 'segurapp.menu.colapsado'

function leerColapsado() {
  try {
    return localStorage.getItem(CLAVE_MENU) === '1'
  } catch {
    return false
  }
}

export function AppShell() {
  const sesion = useSesion()
  const navigate = useNavigate()
  const [menuMovil, setMenuMovil] = useState(false)
  const [colapsado, setColapsado] = useState(leerColapsado)
  const alternarMenu = () =>
    setColapsado((c) => {
      try {
        localStorage.setItem(CLAVE_MENU, c ? '0' : '1')
      } catch {
        /* sin almacenamiento: solo dura esta sesión */
      }
      return !c
    })
  const usuario = sesion?.usuario
  const { pathname } = useLocation()
  const casos = useCasosPendientes()
  const eliminaciones = useConteoEliminaciones()

  const items: ItemMenu[] = [
    { a: '/', texto: 'Inicio', icono: <Home /> },
    { a: '/polizas', texto: 'Pólizas', icono: <ReceiptText />, excluir: '/polizas/eliminaciones' },
    { a: '/catalogos', texto: 'Catálogos', icono: <FolderOpen /> },
    { a: '/reportes', texto: 'Reportes', icono: <BarChart3 /> },
    { a: '/comisiones', texto: 'Reportes de Comisiones', icono: <WalletCards />, visible: veComisiones(usuario) },
    { a: '/casos', texto: 'Casos por revisar', icono: <ClipboardCheck />, contador: casos.data },
    {
      a: '/polizas/eliminaciones',
      texto: 'Eliminaciones por autorizar',
      icono: <Trash2 />,
      visible: esAdmin(usuario),
      contador: eliminaciones.data,
    },
    { a: '/oportunidades', texto: 'Oportunidades SECOP', icono: <Target />, visible: ES_PRUEBAS },
    { a: '/dashboard', texto: 'Dashboard gerencial', icono: <LayoutDashboard />, visible: esAdmin(usuario) },
  ]

  const salir = () => {
    cerrarSesion()
    navigate('/login', { replace: true })
  }

  const menuDe = (c: boolean) => (
    <nav aria-label="Menú principal" className={cn('flex flex-1 flex-col gap-1 overflow-y-auto', c ? 'p-2' : 'p-3')}>
      {items
        .filter((i) => i.visible !== false)
        .map((i) => {
          const activoManual = i.excluir ? pathname.startsWith(i.a) && !pathname.startsWith(i.excluir) : undefined
          return (
            <NavLink
              key={i.a}
              to={i.a}
              end={i.a === '/'}
              onClick={() => setMenuMovil(false)}
              title={c ? i.texto : undefined}
              aria-label={c ? i.texto : undefined}
              className={({ isActive }) =>
                cn(
                  'relative flex min-h-11 items-center gap-3 rounded-[10px] px-3 py-2.5 font-semibold transition-colors [&_svg]:size-[18px]',
                  c && 'justify-center px-0',
                  (activoManual ?? isActive) ? 'bg-navy text-white' : 'text-ink-soft hover:bg-muted hover:text-ink',
                )
              }
            >
              {i.icono}
              {!c && <span className="flex-1">{i.texto}</span>}
              {!!i.contador && (
                <span
                  className={cn(
                    'num rounded-full bg-warning-soft px-2 text-[12px] font-semibold text-warning-ink',
                    c && 'absolute right-0.5 top-0.5 px-1.5 text-[10px] leading-4',
                  )}
                >
                  <span aria-hidden="true">{i.contador}</span>
                  <span className="sr-only">{i.contador === 1 ? '1 pendiente' : `${i.contador} pendientes`}</span>
                </span>
              )}
            </NavLink>
          )
        })}
    </nav>
  )

  const pieDe = (c: boolean) =>
    usuario && (
    <div className={cn('flex border-t border-line p-3', c ? 'flex-col items-center gap-2' : 'items-center gap-3')}>
      <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-green-soft font-bold text-green-ink">
        {usuario.apodo_usuario.slice(0, 1)}
      </div>
      {!c && (
      <div className="min-w-0 flex-1">
        <div className="truncate font-semibold">{usuario.apodo_usuario}</div>
        <div className="truncate text-[12px] text-ink-soft">
          {esAdmin(usuario) ? 'Administrador' : usuario.rol === 'S' ? 'Comisiones' : 'Digitador'}
        </div>
      </div>
      )}
      <button
        type="button"
        onClick={salir}
        title="Cerrar sesión"
        aria-label="Cerrar sesión"
        className="flex size-11 items-center justify-center rounded-lg text-ink-soft hover:bg-muted hover:text-danger"
      >
        <LogOut className="size-4" />
      </button>
    </div>
  )

  const marcaDe = (c: boolean) => (
    <div className={cn('flex items-center gap-3 py-4', c ? 'justify-center px-2' : 'px-4')}>
      <img src={`${import.meta.env.BASE_URL}logo.png`} alt="" className={c ? 'h-8 w-auto' : 'h-10 w-auto'} />
      {!c && (
        <div className="min-w-0">
          <div className="font-bold text-navy">SegurApp</div>
          <div className="truncate text-[11px] font-semibold text-green">Rueda Serrano Asesores</div>
        </div>
      )}
    </div>
  )

  return (
    <div className="flex h-full">
      {/* Menú lateral (escritorio) */}
      <aside className={cn('hidden shrink-0 flex-col border-r border-line bg-surface lg:flex', colapsado ? 'w-[68px]' : 'w-64')}>
        {marcaDe(colapsado)}
        {menuDe(colapsado)}
        <button
          type="button"
          onClick={alternarMenu}
          title={colapsado ? 'Mostrar menú' : 'Ocultar menú'}
          aria-label={colapsado ? 'Mostrar menú' : 'Ocultar menú'}
          aria-expanded={!colapsado}
          className={cn(
            'mx-2 mb-2 flex min-h-11 items-center gap-3 rounded-[10px] px-3 text-ink-soft hover:bg-muted hover:text-ink',
            colapsado && 'justify-center px-0',
          )}
        >
          {colapsado ? <PanelLeftOpen className="size-[18px]" /> : <PanelLeftClose className="size-[18px]" />}
          {!colapsado && <span className="font-semibold">Ocultar menú</span>}
        </button>
        {pieDe(colapsado)}
      </aside>

      {/* Menú móvil: Radix da Escape, foco atrapado, role="dialog" y devuelve el foco al botón. */}
      <Dialog.Root open={menuMovil} onOpenChange={setMenuMovil}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-40 bg-ink/40 lg:hidden" />
          <Dialog.Content
            aria-modal="true"
            aria-describedby={undefined}
            className="fixed inset-y-0 left-0 z-50 flex w-72 flex-col bg-surface shadow-xl focus:outline-none lg:hidden"
          >
            <Dialog.Title className="sr-only">Menú de navegación</Dialog.Title>
            <div className="flex items-center">
              <div className="flex-1">{marcaDe(false)}</div>
              <Dialog.Close asChild>
                <button type="button" aria-label="Cerrar menú" className="mr-3 flex size-11 items-center justify-center rounded-lg hover:bg-muted">
                  <X className="size-5" />
                </button>
              </Dialog.Close>
            </div>
            {menuDe(false)}
            {pieDe(false)}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      <div className="flex min-w-0 flex-1 flex-col">
        {ES_PRUEBAS && (
          <div className="bg-warning-ink px-4 py-1 text-center text-[12px] font-bold tracking-wide text-white">
            AMBIENTE DE PRUEBAS — los datos no son reales
          </div>
        )}
        <header className="flex items-center gap-2 border-b border-line bg-surface px-3 py-2 lg:hidden">
          <button
            type="button"
            aria-label="Abrir menú"
            className="flex size-11 items-center justify-center rounded-lg hover:bg-muted"
            onClick={() => setMenuMovil(true)}
          >
            <Menu className="size-5" />
          </button>
          <img src={`${import.meta.env.BASE_URL}logo.png`} alt="" className="h-7" />
          <span className="font-bold text-navy">SegurApp</span>
        </header>
        <main className="min-h-0 flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

/** Encabezado estándar de cada página: título, subtítulo y acciones. */
export function EncabezadoPagina({
  titulo,
  subtitulo,
  acciones,
  volver,
}: {
  titulo: ReactNode
  subtitulo?: ReactNode
  acciones?: ReactNode
  volver?: string
}) {
  const navigate = useNavigate()
  return (
    <div className="flex flex-wrap items-center gap-3 border-b border-line bg-surface px-4 py-3 sm:px-6">
      {volver && (
        <button
          type="button"
          onClick={() => (window.history.length > 1 ? navigate(-1) : navigate(volver))}
          className="rounded-lg p-2 text-ink-soft hover:bg-muted hover:text-ink"
          aria-label="Volver"
        >
          <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
      )}
      <div className="min-w-0 flex-1">
        <h1 className="truncate text-lg font-semibold">{titulo}</h1>
        {subtitulo && <div className="text-[13px] text-ink-soft">{subtitulo}</div>}
      </div>
      {acciones && <div className="flex flex-wrap items-center gap-2">{acciones}</div>}
    </div>
  )
}

/** Contenedor del contenido de una página con márgenes estándar. */
export function Contenido({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn('mx-auto w-full max-w-[1600px] p-4 sm:p-6', className)}>{children}</div>
}
