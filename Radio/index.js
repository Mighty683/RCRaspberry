/* */
const SPI = require('pi-spi')
  rpio = require('rpio')

Radio.prototype.command = function (cmd, options) {
  return new Promise((resolve, reject) => {
    let writeArray = [cmd]
    let data = options && options.data
    let readBufferLength = options && options.readBufferLength
    if (data) {
      writeArray.concat([data])
      SPI.transfer(writeArray, function (error, data) {
        if (error) {
          reject(error)
        } else {
          resolve(data)
        }
      })
    } else {
      SPI.transfer(writeArray, readBufferLength, function (error, data) {
        if (error) {
          reject(error)
        } else {
          resolve(data)
        }
      })
    }
  })
}

function Radio (spi, cePin) {
  rpio.init()
  rpio.write(8, rpio.HIGH)
  this.spi = SPI.initialize(spi || '/dev/spidev0.0')
  this.cePin = cePin || 25
}

module.exports = Radio