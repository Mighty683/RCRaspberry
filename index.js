const Radio = require('./Radio')
const e = require('./Radio/enums')

let radio = new Radio()
radio.setState(e.cmdCode.powerUP).then(() =>{
  radio.getState().then(data => {
    console.log(Array.from(data.values()).map(value => value.toString(2)))
  })
})
