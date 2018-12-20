const Radio = require('./Radio')
const e = require('./Radio/enums')
let radio = new Radio('/dev/spidev1.2', 33)
let iterator = 0
let string = 'SOLLERS CONSULTING!'
radio.init()
  .then(() => {
    radio.dataToWrite.push(string.charCodeAt(iterator))
    radio.initTX(0xA2A3A1A1A1)
    radio.on('transfered', (data) => {
      console.log('Transfered:', data.toString(2))
    })
    setInterval(() => {
      radio.dataToWrite.push(string.charCodeAt(++iterator))
      if (iterator === string.length - 1) {
        iterator = -1
      }
    }, 1000)
  })