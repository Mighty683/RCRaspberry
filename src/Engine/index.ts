import rpio from "rpio";

const MIN_RANGE = 12;
const MAX_RANGE = 1024;

export class Engine {
  private state: number;
  private readonly pwmPin: number;

  constructor(PWMPin = 12) {
    this.state = MIN_RANGE;
    this.pwmPin = PWMPin;
  }

  initialize(): void {
    rpio.init({
      gpiomem: false,
    });
    rpio.open(this.pwmPin, rpio.PWM);
    rpio.pwmSetClockDivider(64);
    rpio.pwmSetRange(12, 1024);
  }

  throttle(direction: "up" | "down"): void {
    if (direction === "up" && this.state <= MAX_RANGE - 10) {
      this.state = this.state + 10;
    } else if (this.state >= MIN_RANGE + 10) {
      this.state = this.state - 10;
    }
    rpio.pwmSetData(this.pwmPin, this.state);
  }

  turnOff(): void {
    this.state = MIN_RANGE;
    rpio.pwmSetData(this.pwmPin, this.state);
  }
}
