const Radio = require('./Radio')
const e = require('./Radio/enums')

let radio = new Radio()

radio.init()
  .then(() => {
    radio.initRX(0xA2A3A1A1A1, 4)
    radio.on('response:received', data => {
      console.log('Received:', data)
    })
  })
