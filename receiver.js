"use strict"

const Radio = require('./Radio')
const Servo = require('./Servo')
const Engine = require('./Engine')

let radio = new Radio()
let servo = new Servo()
let engine = new Engine()

let centringTimeout;
async function startProgram () {
  // await servo.init()
  await radio.init()
  await radio.initRX(0xA2A3A1A1A1, 4)
  radio.on('response:received', data => {
    clearTimeout(centringTimeout)
    centringTimeout = setTimeout(function () {
      servo.center(0)
      servo.center(1)
    }, 500)
    console.log('Received:', data);
    let target = data[0]
    let command = data[1]
    let commandValue = data.slice(-2)
    if (target === '0' || target === '1') {
      // SERVO COMMANDS
      if (command === '+') {
        servo.move(target, parseInt(commandValue))
      } else if (command === '-') {
        servo.move(target, -parseInt(commandValue))
      } else if (command === 'U') {
        servo.calibrate(target, parseInt(commandValue))
      } else if (command === 'D') {
        servo.calibrate(target, -parseInt(commandValue))
      }
    } else if (target === 'E') {
      // ENGINE COMMAND
      if (command === '+') {
        engine.move(1)
      } else if (command === '-') {
        engine.move(0)
      } else if (command === '0') {
        engine.turnOff()
      }
    }
    
  })
}


startProgram()