const SPI = require('pi-spi')
  rpio = require('rpio')
  e = require('./enums')
  EventEmitter = require('events').EventEmitter
  util = require('util')

Radio.prototype.init = function () {
  return this.readRegister(e.addresses.configRead)
    .then(() => this.powerUP())
    .then(() => new Promise((resolve, reject) => {
      setTimeout(resolve, 5)
    }))
}

Radio.prototype.initTX = function (addrr) {
  return this.setTX()
  .then(() => this.writeRegister(e.addresses.txAddress, addrr))
  .then(() => this.writeRegister(e.addresses.P0Address, addrr))
  .then(() => this.setCE(1))
  .then(async () => {
    this._TX_INTERVAL = setInterval(async () => {
      if (this.dataToWrite.length > 0) {
        await this.readRegister(e.addresses.status)
        .then(data => {
          let operations = []
          let maxRetransmit = (data & 1 << e.cmdLocation.maxRT)
          let txFifoFull = (data & 1 << e.cmdLocation.TX_FIFO_FULL)
          let ackReceived = (data & 1 << e.cmdLocation.TX_DS)
          if (maxRetransmit) {
            console.log('Max retransmit limit reached!')
            operations.push(() => this.writeRegister(e.addresses.status, 1 << e.cmdLocation.maxRT))
          }
          if(txFifoFull) {
            console.log('TX fifo full!')
            operations.push(() => this.command(e.cmd.flushTXFifo))
          }
          if (ackReceived) {
            console.log('ACK Received!')
            operations.push(() => this.writeRegister(e.addresses.status, 1 << e.cmdLocation.TX_DS))
          }
          if (operations.length > 0) {
            return operations.reduce((prev, curr) => {prev.then(curr)}, operations.pop()())
          } else {
            let transferedData = this.dataToWrite.reduce((value, currentValue) => (value << 8) + currentValue, 0)
            this.dataToWrite = []
            return this.write(transferedData)
          }
        })
      }
      if (this.isRX()) {
        clearInterval(this._TX_INTERVAL)
      }
    }, 1)
  })
}

Radio.prototype.initRX = function (addrr, packetLenght) {
  return this.writeRegister(e.addresses.P1Address, addrr)
    .then(() => this.writeRegister(e.addresses.P1Data, 0x20))
    .then(() => this.setRX())
    .then(() => this.setCE(1))
    .then(() => this.writeRegister(e.addresses.P1Data , packetLenght))
    .then(async () => {
      this._RX_INTERVAL = setInterval(async () => {
        await this.readRegister(e.addresses.status)
          .then(data => {
            let rxDataPresent = (data & 1 << e.cmdLocation.RX_FIFO_ACTIVE)
            if (rxDataPresent) {
              return this.writeRegister(e.addresses.status, 1 << e.cmdLocation.RX_FIFO_ACTIVE).then(() => this.read(packetLenght))
            }
          })
          .then(data => {
            if (data) {
              this._lastData = parseData(data)
              this.emit('response:received',this._lastData)
            }
          })
        if (!this.isRX()) {
          clearInterval(this._RX_INTERVAL)
        }
      }, 100)
    })
}

Radio.prototype.command = function (cmd, options) {
  return new Promise((resolve, reject) => {
    let callArgs = []
    let writeArray = transformToTransportArray(cmd)
    let data = options && options.data
    let readBufferLength = options && options.readBufferLength
    if (data) {
      callArgs.push(Buffer.from(writeArray.concat(transformToTransportArray(data))))
    } else {
      callArgs.push(Buffer.from(writeArray))
    }
    if (readBufferLength) {
      callArgs.push(readBufferLength)
    }
    callArgs.push(function (err, data) {
      if (err) {
        reject(err)
      } else {
        resolve(data)
      }
    })
    this.spi.transfer.apply(null, callArgs)
  })
}

Radio.prototype.read = function (length) {
  return this.command(e.cmd.readRXPayload, {
    readBufferLength: length + 1
  })
  .then((data) => Array.from(data.values()).slice(1))
}

Radio.prototype.write = function (data) {
  return this.command(e.cmd.writeTXPayload, {
    data
  })
}

Radio.prototype.readRegister = function (registerToread, readBufferLength) {
  return this.command(e.cmd.readRegisters | registerToread, {
    readBufferLength: readBufferLength + 1 || 2
  }).then(data => {
    let array = Array.from(data.values()).slice(1)
    this.registers[registerToread] = array.length > 1 ? array : array[0]
    return this.registers[registerToread]
  })
}

/*

RX/TX Group

*/

Radio.prototype.setRX = function () {
  if (this.isRX()) {
    return Promise.resolve(this.registers[e.addresses.configRead])
  } else {
    let set = this.registers[e.addresses.configRead] | 1 << e.cmdLocation.rx
    return this.writeRegister(e.addresses.configRead, set)
  }
}

Radio.prototype.setTX = function () {
  if (!this.isRX()) {
    return Promise.resolve(this.registers[e.addresses.configRead])
  } else {
    let set = this.registers[e.addresses.configRead] & ~(1 << e.cmdLocation.rx)
    return this.writeRegister(e.addresses.configRead, set)
  }
}


Radio.prototype.isRX = function () {
  return (this.registers[e.addresses.configRead] & 1 << e.cmdLocation.rx) != 0
}

/*

Main register group: power up and down has to be the same as setState

*/

Radio.prototype.isPowered = function () {
  return (this.registers[e.addresses.configRead] & 1 << e.cmdLocation.power) != 0
}

Radio.prototype.powerUP = function () {
  let set = this.registers[e.addresses.configRead] | 1 << e.cmdLocation.power
  return this.command(e.cmd.writeRegisters | e.addresses.configRead, {
    data: set
  }).then(() => {
    this.registers[e.addresses.configRead] = set
    return this.registers[e.addresses.configRead]
  })
}

Radio.prototype.powerDown = function () {
  let set = this.registers[e.addresses.configRead] & ~(1 << e.cmdLocation.power)
  return this.command(e.addresses.configRead | e.cmd.writeRegisters, {
    data: set
  }).then(() => {
    this.registers[e.addresses.configRead] = set
    return this.registers[e.addresses.configRead]
  })
}

Radio.prototype.writeRegister = function (registerToWrite, set) {
  return this.command(e.cmd.writeRegisters | registerToWrite, {
    data: set
  }).then(() => {
    this.registers[registerToWrite] = set
    return this.registers[registerToWrite]
  })
}

Radio.prototype.pulseCE = function () {
  rpio.write(this.cePin, 0)
  rpio.write(this.cePin, 1)
  rpio.write(this.cePin, 0)
}

Radio.prototype.setCE = function (state) {
  return new Promise((resolve, reject) => {
    if (state !== this._ce) {
      rpio.write(this.cePin, state)
      this._ce = state
      resolve(this._ce)
    } else {
      resolve(this._ce)
    }
  })
}

function Radio (spi, cePin) {
  this.dataToWrite = []
  this.cePin = cePin || 22
  this.spi = SPI.initialize(spi || '/dev/spidev0.0')
  this.registers = {}
  rpio.init()
  rpio.open(this.cePin, rpio.OUTPUT, rpio.LOW)
  this._ce = rpio.LOW
}


util.inherits(Radio, EventEmitter)
module.exports = Radio

function parseData (data) {
  return data.map(charCode => String.fromCharCode(charCode)).join('')
}

function transformToTransportArray (number) {
  let array = []
  let string = number.toString(16)
  if (string.length % 2 === 1) {
    string = '0' + string
  }
  for (let i = 0 ; i < string.length ; i += 2) {
    array.push(string[i] + string[i+1])
  }
  return array.map(e => parseInt(e, 16))
}