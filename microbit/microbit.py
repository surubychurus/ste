# Código para la micro:bit (MicroPython, editor python.microbit.org o Mu)
# Envía por USB-serial: temp:<°C>,light:<0-255>,sound:<0-255>  a 115200 baudios
# - El sonido necesita micro:bit V2 (micrófono integrado).
# - El sensor de luz usa los propios LED: la pantalla debe estar ENCENDIDA
#   (no uses display.off() ni led.enable(false)) o siempre dará 0.
from microbit import *

display.on()
display.show(Image.SQUARE_SMALL)

while True:
    light = display.read_light_level()
    sound = microphone.sound_level()
    print("temp:{},light:{},sound:{}".format(temperature(), light, sound))
    sleep(500)

# --- Equivalente en MakeCode (JavaScript) ---
# basic.showIcon(IconNames.SmallSquare)
# basic.forever(function () {
#     serial.writeLine("temp:" + input.temperature() + ",light:" + input.lightLevel() + ",sound:" + input.soundLevel())
#     basic.pause(500)
# })
