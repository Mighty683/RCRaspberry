/* */
const SPI = require('pi-spi')
  rpio = require('rpio')
  enums = require('./enums')

Radio.prototype.command = function (cmd, options) {
  return new Promise((resolve, reject) => {
    let writeArray = [cmd]
    let data = options && options.data
    let readBufferLength = options && options.readBufferLength
    if (data) {
      writeArray.concat([data])
      this.spi.transfer(new Buffer(writeArray), function (error, data) {
        if (error) {
          reject(error)
        } else {
          resolve(data)
        }
      })
    } else {
      this.spi.transfer(new Buffer(writeArray), readBufferLength, function (error, data) {
        if (error) {
          reject(error)
        } else {
          resolve(data)
        }
      })
    }
  })
}

Radio.prototype.read = function (length) {
  return length ?
  this.command(enums.commands.readRXPayload, {
    data: length
  }) :
  this.command(enums.commands.readRXPayloadFIFO)
}

function Radio (spi, cePin) {
  rpio.init()
  rpio.write(8, rpio.HIGH)
  this.spi = SPI.initialize(spi || '/dev/spidev0.0')
  this.cePin = cePin || 25
}

module.exports = Radio