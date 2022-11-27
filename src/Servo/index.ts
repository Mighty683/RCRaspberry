import i2c, { I2CBus } from "i2c-bus";

const addr = 0x40;

const pins = [
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

const sleep = (time) =>
  new Promise((resolve) => {
    setTimeout(resolve, time);
  });

export class ServoController {
  private bus: I2CBus;

  async init(): Promise<void> {
    this.bus = i2c.openSync(1);
    await this.writeByte(addr, 0, 0x20);
    await sleep(250);
    await this.writeByte(addr, 0, 0x10);
    await sleep(250);
    await this.writeByte(addr, 0xfe, 0x79);
    await this.writeByte(addr, 0, 0x20);
    await sleep(250);
    pins.forEach((pin, index) => this.move(index, pin.center));
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

  async center(pin: number): Promise<void> {
    await this.move(pin, pins[pin].center, true);
  }

  async calibrate(pinCode: number, degrees: number, absolute?: boolean): Promise<void> {
    const pin = pins[pinCode];
    const newCenter = absolute ? degrees : pin.center + degrees;
    if (newCenter < pin.commandRange[0]) {
      pin.center = pin.commandRange[0];
    } else if (newCenter > pin.commandRange[1]) {
      pin.center = pin.commandRange[1];
    } else {
      pin.commandRange[0] = pin.commandRange[0] + degrees;
      pin.commandRange[1] = pin.commandRange[1] + degrees;
      pin.center = newCenter;
    }
    await this.center(pinCode);
  }

  async move(pinCode: number, degrees: number, absolute?: boolean): Promise<void> {
    const pin = pins[pinCode];
    let position = absolute ? degrees : pin.position + degrees;
    if (position < pin.commandRange[0]) {
      position = pin.commandRange[0];
    } else if (position > pin.commandRange[1]) {
      position = pin.commandRange[1];
    }
    pin.position = position;
    await this.writeWord(addr, pin.start, 0);
    await this.writeWord(addr, pin.end, position);
  }

  constructor() {
    // TODO
  }
}
