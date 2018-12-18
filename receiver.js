const Radio = require('./Radio')
const e = require('./Radio/enums')

let radio = new Radio()
function decodeBinary (string) {
  return parseInt(string.replace(' ', ''), 2)
}

console.log('STARTING RECEIVER')
radio.init()
  .then(() => radio.writeRegister(e.addresses.P1Address, 0xAAAAAAAAAA))
  .then(() => radio.setRX())
  .then(() => radio.writeRegister(e.addresses.P1Data, decodeBinary('0000 1000')))
  .then(() => {
    setInterval(() => {
      radio.read(8)
        .then((data) => console.log('Received:', data.map(d => d.toString(16))))
        .then(() => radio.setInitState())
        .then((data) => console.log('State:', data.toString(2)))
    }, 500)
  })