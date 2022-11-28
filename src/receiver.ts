import { Radio } from "./Radio";
import { ServoController } from "./Servo";
import { Engine } from "./Engine";

export async function startReceiver(address: number, spi: string, ce: number): Promise<void> {
  const radio = new Radio(spi, ce);
  const servo = new ServoController();
  const engine = new Engine();
  let centringTimeout: NodeJS.Timeout;

  await servo.init();
  await radio.init();

  await radio.initRX(address);

  radio.on("response:received", (data) => {
    clearTimeout(centringTimeout);
    centringTimeout = setTimeout(function () {
      servo.center(0);
      servo.center(1);
    }, 500);
    const target = data[0];
    const command = data[1];
    const commandValue = data.slice(-2);
    if (target === "0" || target === "1") {
      // SERVO COMMANDS
      if (command === "+") {
        servo.move(target, parseInt(commandValue));
      } else if (command === "-") {
        servo.move(target, -parseInt(commandValue));
      } else if (command === "U") {
        servo.calibrate(target, parseInt(commandValue));
      } else if (command === "D") {
        servo.calibrate(target, -parseInt(commandValue));
      }
    } else if (target === "E") {
      // ENGINE COMMAND
      if (command === "+") {
        engine.move(1);
      } else if (command === "-") {
        engine.move(0);
      } else if (command === "0") {
        engine.turnOff();
      }
    }
  });
}
