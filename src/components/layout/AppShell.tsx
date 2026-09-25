import { useState, type ReactNode } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router'
import { BarChart3, FolderOpen, Home, LogOut, Menu, ReceiptText, WalletCards, X } from 'lucide-react'
import { cerrarSesion, esAdmin, useSesion, veComisiones } from '@/lib/sesion'
import { ES_PRUEBAS } from '@/lib/supabase'
import { cn } from '@/lib/utils'

interface ItemMenu {
  a: string
  texto: string
  icono: ReactNode
  visible?: boolean
}

export function AppShell() {
  const sesion = useSesion()
  const navigate = useNavigate()
  const [menuMovil, setMenuMovil] = useState(false)
  const usuario = sesion?.usuario

  const items: ItemMenu[] = [
    { a: '/', texto: 'Inicio', icono: <Home /> },
    { a: '/polizas', texto: 'Pólizas', icono: <ReceiptText /> },
    { a: '/catalogos', texto: 'Catálogos', icono: <FolderOpen /> },
    { a: '/reportes', texto: 'Reportes', icono: <BarChart3 /> },
    { a: '/comisiones', texto: 'Reportes de Comisiones', icono: <WalletCards />, visible: veComisiones(usuario) },
  ]

  const salir = () => {
    cerrarSesion()
    navigate('/login', { replace: true })
  }

  const menu = (
    <nav className="flex flex-1 flex-col gap-1 p-3">
      {items
        .filter((i) => i.visible !== false)
        .map((i) => (
          <NavLink
            key={i.a}
            to={i.a}
            end={i.a === '/'}
            onClick={() => setMenuMovil(false)}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 rounded-[10px] px-3 py-2.5 font-semibold transition-colors [&_svg]:size-[18px]',
                isActive ? 'bg-navy text-white' : 'text-ink-soft hover:bg-muted hover:text-ink',
              )
            }
          >
            {i.icono}
            {i.texto}
          </NavLink>
        ))}
    </nav>
  )

  const pieUsuario = usuario && (
    <div className="flex items-center gap-3 border-t border-line p-3">
      <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-green-soft font-bold text-green-ink">
        {usuario.apodo_usuario.slice(0, 1)}
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate font-semibold">{usuario.apodo_usuario}</div>
        <div className="truncate text-[12px] text-ink-soft">
          {esAdmin(usuario) ? 'Administrador' : usuario.rol === 'S' ? 'Comisiones' : 'Digitador'}
        </div>
      </div>
      <button
        type="button"
        onClick={salir}
        title="Cerrar sesión"
        className="rounded-lg p-2 text-ink-soft hover:bg-muted hover:text-danger"
      >
        <LogOut className="size-4" />
      </button>
    </div>
  )

  const marca = (
    <div className="flex items-center gap-3 px-4 py-4">
      <img src={`${import.meta.env.BASE_URL}logo.png`} alt="" className="h-10 w-auto" />
      <div className="min-w-0">
        <div className="font-bold text-navy">SegurApp</div>
        <div className="truncate text-[11px] font-semibold text-green">Rueda Serrano Asesores</div>
      </div>
    </div>
  )

  return (
    <div className="flex h-full">
      {/* Menú lateral (escritorio) */}
      <aside className="hidden w-64 shrink-0 flex-col border-r border-line bg-surface lg:flex">
        {marca}
        {menu}
        {pieUsuario}
      </aside>

      {/* Menú móvil */}
      {menuMovil && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-ink/40" onClick={() => setMenuMovil(false)} />
          <aside className="absolute inset-y-0 left-0 flex w-72 flex-col bg-surface shadow-xl">
            <div className="flex items-center">
              <div className="flex-1">{marca}</div>
              <button type="button" className="mr-3 rounded-lg p-2 hover:bg-muted" onClick={() => setMenuMovil(false)}>
                <X className="size-5" />
              </button>
            </div>
            {menu}
            {pieUsuario}
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        {ES_PRUEBAS && (
          <div className="bg-warning px-4 py-1 text-center text-[12px] font-bold tracking-wide text-white">
            AMBIENTE DE PRUEBAS — los datos no son reales
          </div>
        )}
        <header className="flex items-center gap-2 border-b border-line bg-surface px-3 py-2 lg:hidden">
          <button type="button" className="rounded-lg p-2 hover:bg-muted" onClick={() => setMenuMovil(true)}>
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
