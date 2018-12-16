/* */
const SPI = require('pi-spi')
  rpio = require('rpio')
  e = require('./enums')

Radio.prototype.command = function (cmd, options) {
  return new Promise((resolve, reject) => {
    let callArgs = []
    let writeArray = [cmd]
    let data = options && options.data
    let readBufferLength = options && options.readBufferLength
    if (data) {
      writeArray = writeArray.push(data)
      callArgs.push(new Buffer(writeArray))
    } else {
      callArgs.push(new Buffer(writeArray))
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
    console.log(cmd, options)
    console.log(Array.from(callArgs[0].values()))
    this.spi.transfer.apply(null, callArgs)
  })
}

Radio.prototype.read = function (length) {
  return length ?
  this.command(e.cmd.readRXPayload, {
    data: length
  }) :
  this.command(e.cmd.readRXPayload)
}

Radio.prototype.getState = function () {
  return this.command(e.cmd.readRegisters | e.cmdCode.configRea, {
    readBufferLength: 1
  })
}

Radio.prototype.setState = function (set) {
  return this.command(e.cmd.writeRegisters, {
    data: set
  })
}

function Radio (spi, cePin) {
  rpio.init()
  this.cePin = cePin || 24
  rpio.write(this.cePin, rpio.HIGH)
  this.spi = SPI.initialize(spi || '/dev/spidev0.0')
}

module.exports = Radio