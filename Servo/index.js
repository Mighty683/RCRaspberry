"use strict"

const i2c = require('i2c-bus');
const addr = 0x40;
const pins = [
  {
    start: 0x06,
    end: 0x08,
    position: 250,
    center: 250,
    commandRange: [150, 350]
  }, {
    start: 0x0A,
    end: 0x0C,
    position: 250,
    center: 250,
    commandRange: [150, 350]
  }
]

const sleep = time => new Promise((resolve, reject) => {
  setTimeout(resolve, time)
})

class ServoController {

  async init () {
    this.bus = i2c.openSync(1)
    this.bus.writeByteSync(addr, 0, 0x20)
    await sleep(250)
    this.bus.writeByteSync(addr, 0, 0x10)
    await sleep(250)
    this.bus.writeByteSync(addr, 0xfe, 0x79)
    this.bus.writeByteSync(addr, 0, 0x20)
    await sleep(250)
    pins.forEach((pin, index) => this.move(index, pin.center))
    return;
  }
  
  center (pin) {
    this.move(pin, pins[pin].center, true)
  }

  calibrate (pinCode, degrees, absolute) {
    let pin = pins[pinCode]
    let resetRange = false
    let newCenter = absolute ? degrees : pin.center + degrees
    if (newCenter < pin.commandRange[0]) {
      pin.center = pin.commandRange[0]
    } else if (newCenter > pin.commandRange[1]){
      pin.center = pin.commandRange[1]
    } else {
      pin.commandRange[0] = pin.commandRange[0] + degrees
      pin.commandRange[1] = pin.commandRange[1] + degrees
      pin.center = newCenter
    }
    this.center(pinCode)
  }
  
  move (pinCode, degrees, absolute) {
    let pin = pins[pinCode]
    let position = absolute ? degrees : pin.position + degrees
    if (position < pin.commandRange[0]) {
      position = pin.commandRange[0]
    } else if (position > pin.commandRange[1]){
      position = pin.commandRange[1]
    }
    pin.position = position
    this.bus.writeWordSync(addr, pin.start, 0)
    this.bus.writeWordSync(addr, pin.end, position)
  }

  constructor () {
    // TODO
  }
}

module.exports = ServoController