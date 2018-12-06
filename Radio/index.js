/* */
const SPI = require('pi-spi')
  rpio = require('rpio')
  enums = require('./enums')

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
  this.command(enums.commands.readRXPayload, {
    data: length
  }) :
  this.command(enums.commands.readRXPayload)
}

function Radio (spi, cePin) {
  rpio.init()
  rpio.write(8, rpio.HIGH)
  this.spi = SPI.initialize(spi || '/dev/spidev0.0')
  this.cePin = cePin || 25
}

module.exports = Radio