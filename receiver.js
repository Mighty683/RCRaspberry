"use strict"

const Radio = require('./Radio')
const Servo = require('./Servo')
const e = require('./Radio/enums')
let radio = new Radio('/dev/spidev1.2', 33)
let servo = new Servo()
let centringTimeout
async function startProgram () {
  await servo.init()
  await radio.init()
  await radio.initRX(0xA2A3A1A1A1, 4)
  radio.on('response:received', data => {
    clearTimeout(centringTimeout)
    centringTimeout = setTimeout(function () {
      servo.center(0)
      servo.center(1)
    }, 500)
    let servoCode = data[0]
    let servoCommand = data[1]
    let commandValue = data.slice(-2)
    if (servoCommand === '+') {
      servo.move(servoCode, parseInt(commandValue))
    } else if (servoCommand === '-') {
      servo.move(servoCode, -parseInt(commandValue))
    } else if (servoCommand === 'U') {
      servo.calibrate(servoCode, parseInt(commandValue))
    } else if (servoCommand === 'D') {
      servo.calibrate(servoCode, -parseInt(commandValue))
    }
  })
}


startProgram()