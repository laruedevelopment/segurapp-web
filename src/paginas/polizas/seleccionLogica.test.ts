import { describe, expect, it } from 'vitest'
import { MAX_SELECCION } from '@/datos/eliminacionLogica'
import { alternarTodasVisibles, estadoSeleccionVisibles } from './seleccionLogica'

const filas = (n: number) => Array.from({ length: n }, (_, i) => ({ id: i + 1 }))

describe('estadoSeleccionVisibles', () => {
  it('sin filas o sin marcar es ninguna', () => {
    expect(estadoSeleccionVisibles([], new Set())).toBe('ninguna')
    expect(estadoSeleccionVisibles(filas(3), new Set())).toBe('ninguna')
  })
  it('distingue algunas y todas', () => {
    expect(estadoSeleccionVisibles(filas(3), new Set([2]))).toBe('algunas')
    expect(estadoSeleccionVisibles(filas(3), new Set([1, 2, 3]))).toBe('todas')
  })
  it('ignora las marcadas que no se ven', () => {
    expect(estadoSeleccionVisibles(filas(2), new Set([99]))).toBe('ninguna')
  })
  it('con más del tope, "todas" son las primeras 200', () => {
    const sel = new Set(filas(MAX_SELECCION).map((p) => p.id))
    expect(estadoSeleccionVisibles(filas(MAX_SELECCION + 50), sel)).toBe('todas')
  })
})

describe('alternarTodasVisibles', () => {
  it('marca todas si faltan', () => {
    const r = alternarTodasVisibles(filas(3), new Set([1]))
    expect([...r.sel]).toEqual([1, 2, 3])
    expect(r.recortado).toBe(false)
  })
  it('quita todas si ya estaban', () => {
    expect(alternarTodasVisibles(filas(3), new Set([1, 2, 3])).sel.size).toBe(0)
  })
  it('respeta el tope de 200 y avisa del recorte', () => {
    const r = alternarTodasVisibles(filas(MAX_SELECCION + 10), new Set())
    expect(r.sel.size).toBe(MAX_SELECCION)
    expect(r.recortado).toBe(true)
  })
})
