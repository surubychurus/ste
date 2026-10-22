# Panel micro:bit

Node (serialport + ws) · React · three.js · GSAP. Muestra temperatura, luz y sonido (sonido solo en micro:bit V2).

## Uso
1. Carga `microbit/microbit.py` en la micro:bit (envía `temp:24,light:120,sound:60` cada 500 ms a 115200 baudios).
2. Cierra cualquier programa que use el puerto serie (Mu, MakeCode, monitor serial).
3. `npm run dev` y abre http://localhost:5173
   - Sin micro:bit: `npm run dev:sim`
   - Puerto manual: `$env:SERIAL_PORT="COM5"; npm run dev`
   - Producción: `npm run build && npm start` → http://localhost:3001

Formatos de línea aceptados: `temp:24,light:120,sound:60`, `t=24 l=120`, `24,120`, `{"temp":24,"light":120}`.
