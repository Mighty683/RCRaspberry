/* */
const SPI = require('pi-spi')
  rpio = require('rpio')
  e = require('./enums')

Radio.prototype.init = function () {
  return this.setInitState()
    .then(() => this.powerUP())
    .then(() => new Promise((resolve, reject) => {
      setTimeout(resolve, 5)
    }))
}

Radio.prototype.command = function (cmd, options) {
  return new Promise((resolve, reject) => {
    let callArgs = []
    let writeArray = transformToTransportArray(cmd)
    let data = options && options.data
    let readBufferLength = options && options.readBufferLength
    if (data) {
      callArgs.push(Buffer.from(writeArray.concat(transformToTransportArray(data))))
    } else {
      callArgs.push(Buffer.from(writeArray))
    }
    if (readBufferLength) {
      callArgs.push(readBufferLength)
    }
    callArgs.push(function (err, data) {
      if (err) {
        reject(err)
      } else {
        resolve(data)
      }
    })
    this.spi.transfer.apply(null, callArgs)
  })
}

Radio.prototype.read = function (length) {
  return this.command(e.cmd.readRXPayload, {
    readBufferLength: length + 1
  })
  .then((data) => {
    return this.setCE(1).then(() => Array.from(data.values()).slice(1))
  })
  .then((data) => this.command(e.cmd.flushRXFifo).then(() => data))
}

Radio.prototype.write = function (data) {
  let exec = () => {
    return this.command(e.cmd.writeTXPayload, {
      data
    }).then(() => this.pulseCE())
  }
  return this.readRegister(e.addresses.status)
    .then((data) => {
      let mask = 1 << e.cmdLocation.maxRT
      if ((data & mask) != 0) {
        return this.writeRegister(e.addresses.status, mask)
      } else {
        return data
      }
    })
    .then(() => {
      return this.isRX()
      ? this.setTX().then(() => exec())
      : exec()
  })
}

Radio.prototype.setInitState = function () {
  return this.readRegister(e.addresses.configRead)
}

Radio.prototype.readRegister = function (registerToread, readBufferLength) {
  return this.command(e.cmd.readRegisters | registerToread, {
    readBufferLength: readBufferLength || 2
  }).then(data => {
    this.registers[registerToread] = Array.from(data.values()).slice(1)[0]
    return this.registers[registerToread]
  })
}

/*

RX/TX Group

*/

Radio.prototype.setRX = function () {
  if (this.isRX()) {
    return this.registers[e.addresses.configRead]
  } else {
    let set = this.registers[e.addresses.configRead] | 1 << e.cmdLocation.rx
    return this.writeRegister(e.addresses.configRead, set)
  }
}

Radio.prototype.setTX = function () {
  let set = this.registers[e.addresses.configRead] & ~(1 << e.cmdLocation.rx)
  return this.writeRegister(e.addresses.configRead, set)
}


Radio.prototype.isRX = function () {
  return (this.registers[e.addresses.configRead] & 1 << e.cmdLocation.rx) != 0
}

/*

Main register group: power up and down has to be the same as setState

*/

Radio.prototype.isPowered = function () {
  return (this.registers[e.addresses.configRead] & 1 << e.cmdLocation.power) != 0
}

Radio.prototype.powerUP = function () {
  let set = this.registers[e.addresses.configRead] | 1 << e.cmdLocation.power
  return this.command(e.cmd.writeRegisters | e.addresses.configRead, {
    data: set
  }).then(() => {
    this.registers[e.addresses.configRead] = set
    return this.registers[e.addresses.configRead]
  })
}

Radio.prototype.powerDown = function () {
  let set = this.registers[e.addresses.configRead] & ~(1 << e.cmdLocation.power)
  return this.command(e.addresses.configRead | e.cmd.writeRegisters, {
    data: set
  }).then(() => {
    this.registers[e.addresses.configRead] = set
    return this.registers[e.addresses.configRead]
  })
}

Radio.prototype.writeRegister = function (registerToWrite, set) {
  let exec = () => this.command(e.cmd.writeRegisters | registerToWrite, {
    data: set
  }).then(() => {
    this.registers[registerToWrite] = set
    return this.registers[registerToWrite]
  })
  .then(() => this.powerUP())
  .then(() => this.setCE(0))
  if (this.isPowered()) {
    return this.powerDown().then(() => {
      return exec()
    })
  } else {
    return exec()
  }
}

Radio.prototype.pulseCE = function () {
  let time = process.hrtime()[1]
  rpio.write(this.cePin, 1)
  let time2 = process.hrtime()[1]
  rpio.write(this.cePin, 0)
  console.log(Math.round((time2 - time) / 1000))
}

Radio.prototype.setCE = function (state) {
  return new Promise((resolve, reject) => {
    if (state !== this._ce) {
      rpio.write(this.cePin, state)
      this._ce = state
      resolve(this._ce)
    } else {
      resolve(this._ce)
    }
  })
}



function Radio (spi, cePin) {
  this.cePin = cePin || 22
  this.spi = SPI.initialize(spi || '/dev/spidev0.0')
  this.registers = {}
  rpio.init()
  rpio.open(this.cePin, rpio.OUTPUT, rpio.LOW)
  this._ce = rpio.LOW
}

module.exports = Radio

function transformToTransportArray (number) {
  let array = []
  let string = number.toString(16)
  if (string.length % 2 === 1) {
    string = '0' + string
  }
  for (let i = 0 ; i < string.length ; i += 2) {
    array.push(string[i] + string[i+1])
  }
  return array.map(e => parseInt(e, 16))
}