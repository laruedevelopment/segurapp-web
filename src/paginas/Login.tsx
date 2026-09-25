import { useState } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router'
import { Eye, EyeOff, LogIn } from 'lucide-react'
import { Boton } from '@/components/ui/button'
import { Campo, Input } from '@/components/ui/campos'
import { Dialogo } from '@/components/ui/dialogo'
import { iniciarSesion, useSesion } from '@/lib/sesion'
import { ES_PRUEBAS } from '@/lib/supabase'

export default function Login() {
  const sesion = useSesion()
  const navigate = useNavigate()
  const location = useLocation()
  const mensajeInicial = (location.state as { mensaje?: string } | null)?.mensaje
  const [apodo, setApodo] = useState('')
  const [clave, setClave] = useState('')
  const [verClave, setVerClave] = useState(false)
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [olvido, setOlvido] = useState(false)

  if (sesion) return <Navigate to="/" replace />

  const entrar = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!apodo.trim() || !clave) {
      setError('Escriba su usuario y su contraseña.')
      return
    }
    setCargando(true)
    setError(null)
    const r = await iniciarSesion(apodo, clave)
    setCargando(false)
    if (r.ok) {
      const destino = (location.state as { desde?: string } | null)?.desde ?? '/'
      navigate(destino, { replace: true })
    } else {
      setError(r.mensaje)
    }
  }

  return (
    <div className="flex min-h-full items-center justify-center bg-gradient-to-br from-navy-soft via-bg to-green-soft p-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center text-center">
          <img src={`${import.meta.env.BASE_URL}logo.png`} alt="Rueda Serrano Asesores de Seguros" className="h-20" />
          <h1 className="mt-3 text-2xl font-bold text-navy">SegurApp</h1>
          <p className="text-[13px] font-semibold text-green">Rueda Serrano Asesores de Seguros</p>
          {ES_PRUEBAS && (
            <span className="mt-2 rounded-full bg-warning px-3 py-0.5 text-[11px] font-bold text-white">PRUEBAS</span>
          )}
        </div>
        <form onSubmit={entrar} className="space-y-4 rounded-2xl border border-line bg-surface p-6 shadow-sm">
          {mensajeInicial && !error && (
            <div className="rounded-[10px] bg-warning-soft px-3 py-2 text-[13px] text-warning-ink">{mensajeInicial}</div>
          )}
          <Campo etiqueta="Usuario">
            <Input autoFocus autoComplete="username" value={apodo} onChange={(e) => setApodo(e.target.value)} />
          </Campo>
          <Campo etiqueta="Contraseña">
            <div className="relative">
              <Input
                type={verClave ? 'text' : 'password'}
                autoComplete="current-password"
                className="pr-10"
                value={clave}
                onChange={(e) => setClave(e.target.value)}
              />
              <button
                type="button"
                className="absolute top-1/2 right-2 -translate-y-1/2 rounded p-1 text-ink-soft hover:text-ink"
                onClick={() => setVerClave((v) => !v)}
                aria-label={verClave ? 'Ocultar contraseña' : 'Mostrar contraseña'}
              >
                {verClave ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
          </Campo>
          {error && <div className="rounded-[10px] bg-danger-soft px-3 py-2 text-[13px] text-danger">{error}</div>}
          <Boton type="submit" className="w-full" cargando={cargando}>
            {!cargando && <LogIn />}
            Ingresar
          </Boton>
          <button type="button" className="w-full text-center text-[13px] text-navy hover:underline" onClick={() => setOlvido(true)}>
            ¿Olvidó su contraseña?
          </button>
        </form>
      </div>
      <Dialogo
        abierto={olvido}
        onCerrar={() => setOlvido(false)}
        titulo="¿Olvidó su contraseña?"
        ancho="sm"
        pie={<Boton onClick={() => setOlvido(false)}>Entendido</Boton>}
      >
        <p className="text-ink-soft">
          Por seguridad, la contraseña solo la puede restablecer un administrador. Pídale que le asigne una nueva desde
          Catálogos → Usuarios.
        </p>
      </Dialogo>
    </div>
  )
}
