/* */
const i2c = require('i2c-bus');
const addr = 0x40;
const pins = [
  {
    start: 0x06,
    end: 0x08,
    position: 250,
    center: 250,
    commandRange: [100, 416]
  }, {
    start: 0x0A,
    end: 0x0C,
    position: 250,
    center: 250,
    commandRange: [100, 416]
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
  pins.forEach((pin, index) => this.move(index, pin.center))
  return;
}

ServoController.prototype.move = async function (pinCode, degrees) {
  let pin = pins[pinCode]
  let position = pin.position + degrees
  console.log(position)
  if (position < pin.commandRange[0]) {
    position = pin.commandRange[0]
  } else if (position > pin.commandRange[1]){
    position = pin.commandRange[1]
  }
  pin.position = position
  this.bus.writeWordSync(addr, pin.start, 0)
  this.bus.writeWordSync(addr, pin.end, position)
}

function ServoController () {

}

module.exports = ServoController