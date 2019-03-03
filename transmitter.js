
"use strict"

process.stdin.setRawMode(true)

const Radio = require('./Radio')
let radio = new Radio()

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
    if (key === 'w') {
      command = '0U05'
    }
    if (key === 's') {
      command = '0D05'
    }
    if (key === 'a') {
      command = '1U05'
    }
    if (key === 'd') {
      command = '1D05'
    }
    if (key === 'Z') {
      command = 'E+00'
    }
    if (key === 'X') {
      command = 'E-00'
    }
    radio.transmit(command).then(() => console.log('Transmitted:', command))
  })
}


startTrasmitter()