const Radio = require('./Radio')
const e = require('./Radio/enums')
let radio = new Radio('/dev/spidev1.2', 33)
let iterator = 0
let string = 'Kocham patrycje!'
let dataSets = string.match(/.{1,4}/g).map(string => string.padEnd(4, ' '))
console.log(dataSets)
radio.init()
  .then(() => {
    radio.dataToWrite.push(string.charCodeAt(iterator))
    radio.initTX(0xA2A3A1A1A1)
    setInterval(() => {
      radio.dataToWrite = dataSets[++iterator].split('').map(char => char.charCodeAt(0))
      if (iterator === dataSets.length - 1) {
        iterator = -1
      }
    }, 100)
  })