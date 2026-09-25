import { Boton } from '@/components/ui/button'
import { Dialogo } from '@/components/ui/dialogo'

/**
 * Crear o editar un cliente en un diálogo (lo usa el formulario de pólizas
 * para editar el cliente sin salir de la pantalla, y el catálogo de clientes).
 *
 * CONTRATO (no cambiar la firma): clienteId null = cliente nuevo;
 * inicial = valores sugeridos para un cliente nuevo (ej. los que leyó la IA);
 * onGuardado recibe el id del cliente creado o editado.
 *
 * Provisional: el módulo de catálogos lo reemplaza con el formulario completo.
 */
export interface PropsDialogoCliente {
  abierto: boolean
  clienteId: number | null
  inicial?: Partial<{
    nombre_cliente: string
    tipopers_cliente: string
    tipodoc_cliente: string
    doc_cliente: string
    tel_cliente: string
    correo_cliente: string
    dir_cliente: string
  }>
  onCerrar: () => void
  onGuardado: (id: number) => void
}

export function DialogoCliente({ abierto, onCerrar }: PropsDialogoCliente) {
  return (
    <Dialogo abierto={abierto} onCerrar={onCerrar} titulo="Cliente" pie={<Boton onClick={onCerrar}>Cerrar</Boton>}>
      <p className="text-ink-soft">En construcción.</p>
    </Dialogo>
  )
}
