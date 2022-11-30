import { Radio } from "./Radio";
import { ServoController, ServoCode } from "./Servo";
import { Engine } from "./Engine";

export async function startReceiver(address: number, spi: string, ce: number): Promise<void> {
  const radio = new Radio(spi, ce);
  const servo = new ServoController();
  const engine = new Engine();
  let centringTimeout: NodeJS.Timeout;

  engine.initialize();
  await servo.initialize();
  await radio.initialize();

  await radio.enableReceiverMode(address);

  radio.on("response:received", (data) => {
    console.log(`Received: ${data}`);
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
      const servoCode = parseInt(target) as ServoCode;
      if (command === "+") {
        servo.move(servoCode, parseInt(commandValue));
      } else if (command === "-") {
        servo.move(servoCode, -parseInt(commandValue));
      } else if (command === "U") {
        servo.calibrate(servoCode, parseInt(commandValue));
      } else if (command === "D") {
        servo.calibrate(servoCode, -parseInt(commandValue));
      }
    } else if (target === "E") {
      if (command === "+") {
        engine.throttle("up");
      } else if (command === "-") {
        engine.throttle("down");
      } else if (command === "0") {
        engine.turnOff();
      }
    }
  });
}
