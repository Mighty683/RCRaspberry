const Radio = require('./Radio')

let radio = new Radio()

radio.getState().then(data => {
  console.log(data.toJSON())
})