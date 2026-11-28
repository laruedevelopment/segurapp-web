# Genera una pista de fondo propia (sin derechos de terceros): bombo, contratiempo, bajo y arpegio.
# Uso: python musica.py salida.wav segundos
import math
import random
import struct
import sys
import wave
from array import array

SR = 44100
BPM = 112
PULSO = 60 / BPM
random.seed(7)

salida, segundos = sys.argv[1], float(sys.argv[2])
total = int(SR * segundos)
mezcla = array('d', [0.0]) * total


def poner(t, muestras):
    i0 = int(t * SR)
    for i, v in enumerate(muestras):
        if i0 + i >= total:
            break
        mezcla[i0 + i] += v


def bombo():
    fase, out = 0.0, []
    for i in range(int(SR * 0.22)):
        t = i / SR
        fase += 2 * math.pi * (48 + 90 * math.exp(-t * 32)) / SR
        out.append(0.55 * math.sin(fase) * math.exp(-t * 15))
    return out


def platillo(vol):
    prev, out = 0.0, []
    for i in range(int(SR * 0.06)):
        r = random.uniform(-1, 1)
        out.append(vol * (r - prev) * 0.5 * math.exp(-i / SR * 70))
        prev = r
    return out


def nota(freq, dur, vol, decae, brillo=0.0):
    out = []
    for i in range(int(SR * dur)):
        t = i / SR
        env = min(1.0, t * 200) * math.exp(-t * decae)
        v = math.sin(2 * math.pi * freq * t) + brillo * math.sin(4 * math.pi * freq * t)
        out.append(vol * env * v)
    return out


def hz(midi):
    return 440 * 2 ** ((midi - 69) / 12)


# Progresión en Do: C  G  Am  F (un compás cada uno)
ACORDES = [(36, [60, 64, 67, 72]), (43, [59, 62, 67, 71]), (45, [60, 64, 69, 72]), (41, [60, 65, 69, 72])]
golpe = bombo()
cerrado, abierto = platillo(0.10), platillo(0.17)
cache = {}


def n(*args):
    if args not in cache:
        cache[args] = nota(*args)
    return cache[args]


compas = 0
while compas * 4 * PULSO < segundos:
    inicio = compas * 4 * PULSO
    bajo, arpegio = ACORDES[compas % 4]
    for b in range(4):
        t = inicio + b * PULSO
        if compas >= 2:
            poner(t, golpe)
        poner(t + PULSO / 2, abierto)
        poner(t + PULSO / 4, cerrado)
        poner(t + PULSO * 3 / 4, cerrado)
        poner(t + PULSO / 2, n(hz(bajo), PULSO / 2, 0.22, 6.0, 0.3))
    for k in range(8):
        poner(inicio + k * PULSO / 2, n(hz(arpegio[[0, 1, 2, 3, 2, 1, 2, 3][k]]), PULSO * 0.9, 0.075, 7.0, 0.25))
    compas += 1

pico = max(1e-9, max(abs(v) for v in mezcla))
fundido = int(SR * 2.0)
datos = bytearray()
for i, v in enumerate(mezcla):
    g = min(1.0, i / (SR * 0.5), (total - i) / fundido)
    datos += struct.pack('<h', int(30000 * g * v / pico))
with wave.open(salida, 'wb') as w:
    w.setnchannels(1)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes(bytes(datos))
