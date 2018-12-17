const Radio = require('./Radio')
let radio = new Radio()

radio.init().then(() => {
  setInterval(() => {
    radio.write(Buffer.from([Date.now()])).then(() => {
      console.log('Data Send:', Date.now())
    })
  }, 1000)
})