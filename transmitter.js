const Radio = require('./Radio')
const e = require('./Radio/enums')
let radio = new Radio('/dev/spidev1.2', 33)
let iterator = 0xAAFFFFFF
radio.init()
  .then(() => radio.writeRegister(e.addresses.txAddress, 0xAAAAAAAAAA))
  .then(() => radio.writeRegister(e.addresses.P0Address, 0xAAAAAAAAAA))
  .then(() => {
    setInterval(() => {
      radio.readRegister(e.addresses.status)
        .then((data) => console.log('Status before transmit:', data.toString(2)))
        .then(() => radio.write(iterator--))
        .then(() => {
          return console.log('Data Send:', iterator.toString(16))
        })
        .then(() => radio.setInitState())
        .then((data) => console.log('State:', data.toString(2)))
    }, 1000)
  })