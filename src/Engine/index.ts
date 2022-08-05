import { EventEmitter } from "events";

import rpio from "rpio";

const MIN_RANGE = 12;
const MAX_RANGE = 1024;

export class Engine extends EventEmitter {
  private state: number;
  private readonly pwmPin: number;

  constructor(PWMPin = 12) {
    super();

    rpio.init({
      gpiomem: false,
    });

    rpio.open(PWMPin, rpio.PWM);
    rpio.pwmSetClockDivider(64);
    rpio.pwmSetRange(12, 1024);

    this.state = MIN_RANGE;
    this.pwmPin = PWMPin;
  }

  move(direction: number): void {
    if (direction && this.state <= MAX_RANGE - 10) {
      this.state = this.state + 10;
    } else if (this.state >= MIN_RANGE + 10) {
      this.state = this.state - 10;
    }
    rpio.pwmSetData(this.pwmPin, this.state);
  }

  turnOff(): void {
    this.state = MIN_RANGE;
  }
}
