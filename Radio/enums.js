function decodeBinary (string) {
  return parseInt(string.replace(' ', ''), 2)
}

module.exports = {
  cmd: {
    readRegisters:  decodeBinary('0000 0000'),
    writeRegisters: decodeBinary('0010 0000'),
    readRXPayload: decodeBinary('0110 0001'),
    writeTXPayload: decodeBinary('1010 0000'),
    flushTXFifo: decodeBinary('1110 0001'),
    flushRXFifo: decodeBinary('1110 0010'),
    reuseTXPayload: decodeBinary('1110 0011'), // PTX Device only
    readRXPayloadFIFO: decodeBinary('0110 0000'),
    writeWithACK: decodeBinary('1010 1000'),
    writeNoACK: decodeBinary('1011 0000'), // disable ack for single package
    noOperation: decodeBinary('1111 1111')
  },
  cmdCode: {
    configRead: 0x00,
    setRX: 0x01,
    powerUP: 0x02,
    powerDOWN: 0x00
  }
}
