const Radio = require('./Radio')

let radio = new Radio()

radio.read().then(data => {
  console.log(data)
})