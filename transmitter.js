const Radio = require('./Radio')
const e = require('./Radio/enums')
let radio = new Radio('/dev/spidev1.2', 33)
let iterator = 0x00
radio.init()
  .then(() => {
    radio.dataToWrite.push(iterator)
    radio.initTX(0xA2A3A1A1A1)
    radio.on('transfered', (data) => {
      console.log('Transfered:', data.toString(2))
      radio.dataToWrite.push(iterator)
    })
  })