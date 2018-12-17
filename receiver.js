const Radio = require('./Radio')

let radio = new Radio()

function parseData (data) {
  return data && Array.from(data.values()).map(v => v.toString(2))
}
console.log('STARTING RECEIVER')
radio.init().then(data => {
  console.log(parseData(data))
}).then(() => radio.setRX())
  .then(() => radio.getState())
  .then(() => {
    setInterval(() => {
      radio.read(1).then((data) => console.log('Received:', parseData(data), Date.now()))
    })
  }, 100)
  .then((data) => {
    console.log(parseData(data))
  })
