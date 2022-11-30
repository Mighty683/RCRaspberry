import i2c, { I2CBus } from "i2c-bus";

const sleep = (time) =>
  new Promise((resolve) => {
    setTimeout(resolve, time);
  });

export type ServoCode = 0 | 1;

export class ServoController {
  private static piServoShieldAddr = 0x40;
  private bus: I2CBus;
  private servos = [
    {
      start: 0x06,
      end: 0x08,
      position: 250,
      center: 250,
      commandRange: [150, 350],
    },
    {
      start: 0x0a,
      end: 0x0c,
      position: 250,
      center: 250,
      commandRange: [150, 350],
    },
  ];

  async initialize(): Promise<void> {
    this.bus = i2c.openSync(1);
    await this.writeByte(ServoController.piServoShieldAddr, 0, 0x20);
    await sleep(250);
    await this.writeByte(ServoController.piServoShieldAddr, 0, 0x10);
    await sleep(250);
    await this.writeByte(ServoController.piServoShieldAddr, 0xfe, 0x79);
    await this.writeByte(ServoController.piServoShieldAddr, 0, 0x20);
    await sleep(250);
    this.servos.forEach((servo, index) => this.move(index as ServoCode, servo.center));
    return;
  }

  writeByte(addr: number, cmd: number, byte: number): Promise<void> {
    return new Promise((resolve) => {
      this.bus.writeByte(addr, cmd, byte, resolve);
    });
  }

  writeWord(addr: number, cmd: number, word: number): Promise<void> {
    return new Promise((resolve) => {
      this.bus.writeWord(addr, cmd, word, resolve);
    });
  }

  async center(servoCode: ServoCode): Promise<void> {
    await this.move(servoCode, this.servos[servoCode].center, true);
  }

  async calibrate(servoCode: ServoCode, degrees: number, absolute?: boolean): Promise<void> {
    const servo = this.servos[servoCode];
    const newCenter = absolute ? degrees : servo.center + degrees;
    if (newCenter < servo.commandRange[0]) {
      servo.center = servo.commandRange[0];
    } else if (newCenter > servo.commandRange[1]) {
      servo.center = servo.commandRange[1];
    } else {
      servo.commandRange[0] = servo.commandRange[0] + degrees;
      servo.commandRange[1] = servo.commandRange[1] + degrees;
      servo.center = newCenter;
    }
    await this.center(servoCode);
  }

  async move(servoCode: ServoCode, degrees: number, absolute?: boolean): Promise<void> {
    const servo = this.servos[servoCode];
    let position = absolute ? degrees : servo.position + degrees;
    if (position < servo.commandRange[0]) {
      position = servo.commandRange[0];
    } else if (position > servo.commandRange[1]) {
      position = servo.commandRange[1];
    }
    servo.position = position;
    await this.writeWord(ServoController.piServoShieldAddr, servo.start, 0);
    await this.writeWord(ServoController.piServoShieldAddr, servo.end, position);
  }
}
