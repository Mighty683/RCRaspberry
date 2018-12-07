/* */
const SPI = require('pi-spi')
  rpio = require('rpio')
  e = require('./e')

Radio.prototype.command = function (cmd, options) {
  return new Promise((resolve, reject) => {
    let callArgs = []
    let writeArray = [cmd]
    let data = options && options.data
    let readBufferLength = options && options.readBufferLength
    if (data) {
      writeArray.concat([data])
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
  return this.command(e.cmd.readRegisters, e.cmdCode.configRead)
}

function Radio (spi, cePin) {
  rpio.init()
  rpio.write(8, rpio.HIGH)
  this.spi = SPI.initialize(spi || '/dev/spidev0.0')
  this.cePin = cePin || 25
}

module.exports = Radio