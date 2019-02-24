process.stdin.setRawMode(true)

const Radio = require('./Radio')
let radio = new Radio('/dev/spidev1.2', 33)

async function  startTrasmitter () {
  await radio.init()
  await radio.initTX(0xA2A3A1A1A1)
  process.stdin.resume()
  process.stdin.setEncoding('utf8')
  process.stdin.on('data', function (key) {
    let command = '0000'
    if ( key === '\u0003' ) {
      process.exit()
    }
    if ( key === '\u001b[A') {
      command = '0+10'
    }
    if ( key === '\u001b[B') {
      command = '0-10'
    }
    if ( key === '\u001b[D') {
      command = '1+10'
    }
    if ( key === '\u001b[C') {
      command = '1-10'
    }
    radio.transmit(command).then(() => console.log('Transmitted:', command))
  })
}


startTrasmitter()