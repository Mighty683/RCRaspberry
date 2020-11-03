const rpio = require('rpio')
const EventEmitter = require('events').EventEmitter
const MIN_RANGE = 12
const MAX_RANGE = 1024

class Engine extends EventEmitter {
  constructor (PWMPin) {
    super()
    rpio.init({
      gpiomem: false,
    });
    rpio.open(PWMPin || 12, rpio.PWM)
    rpio.pwmSetClockDivider(64)
    rpio.pwmSetRange(12, 1024)

    this.state = MIN_RANGE
    this.pin = PWMPin

  }

  move (direction) {
    if (direction && this.state <= MAX_RANGE - 10) {
      this.state = this.state + 10
    } else if (this.state >= MIN_RANGE + 10){
      this.state = this.state - 10
    }
    rpio.pwmSetData(this.pin, this.state)
  }

  turnOff () {
    this.state = MIN_RANGE
  }
}
module.exports = Engine