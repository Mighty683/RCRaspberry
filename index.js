const Radio = require('./Radio')

let radio = new Radio()

radio.getState().then(data => {
  console.log(Array.from(data.values()).map(value => value.toString(2)))
})
