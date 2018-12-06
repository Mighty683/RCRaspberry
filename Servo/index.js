/* */
const i2c = require('i2c-bus');
const addr = 0x40;
const commandRange = [100, 416]
const pins = [
  {
    start: 0x06,
    end: 0x08
  }, {
    start: 0x0A,
    end: 0x0C
  }
]

const sleep = time => new Promise((resolve, reject) => {
  setTimeout(resolve, time)
})

ServoController.prototype.init = async function () {
  this.bus = i2c.openSync(1)
  this.bus.writeByteSync(addr, 0, 0x20)
  await sleep(250)
  this.bus.writeByteSync(addr, 0, 0x10)
  await sleep(250)
  this.bus.writeByteSync(addr, 0xfe, 0x79)
  this.bus.writeByteSync(addr, 0, 0x20)
  await sleep(250)
  return;
}

ServoController.prototype.move = async function (pin, degrees) {
  this.bus.writeWordSync(addr, pins[pin].start, 0)
  this.bus.writeWordSync(addr, pins[pin].end, degrees)
}

function ServoController () {

}

module.exports = ServoController