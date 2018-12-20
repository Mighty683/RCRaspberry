const Radio = require('./Radio')
const e = require('./Radio/enums')

let radio = new Radio()
function decodeBinary (string) {
  return parseInt(string.replace(' ', ''), 2)
}
radio.init()
  .then(() => {
    radio.initRX(0xA2A3A1A1A1)
    radio.on('response:received', data => {
      console.log('Received:', data.map(d => d.toString(16)).join(''))
    })
  })
