const Radio = require('./Radio')

let radio = new Radio()

function parseData (data) {
  return data && Array.from(data.values()).map(v => v.toString(2))
}

if (process.argv[2]) {
  console.log('STARTING RECEIVER')
  radio.init().then(data => {
    console.log(parseData(data))
  }).then(() => radio.powerUP())
    .then(() => radio.setRX())
    .then(() => radio.getState())
    .then(data => console.log('State after init:', parseData(data)))
    .then(() => {
      setInterval(() => {
        radio.read(1).then((data) => console.log(parseData(data)))
      })
    }, 100)
    .then((data) => {
      console.log(parseData(data))
    })
} else {
  console.log('STARTING TRASMITTER')
  radio.init().then(data => {
    console.log(parseData(data))
  }).then(() => radio.powerUP())
    .then(() => radio.setTX())
    .then(() => radio.getState())
    .then(data => console.log('State after init:', parseData(data)))
    .then(() => {
      setInterval(() => {
        radio.write(Buffer.from('DUPA!')).then(() => {
          console.log('Data Send:', Date.now())
        })
      }, 100)
    })

}

