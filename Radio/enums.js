function decodeBinary (string) {
  return parseInt(string.replace(' ', ''), 2)
}

module.exports = {
  cmd: {
    readRegisters:  0x00,
    writeRegisters: decodeBinary('0010 0000'),
    readRXPayload: decodeBinary('0110 0001'),
    writeTXPayload: decodeBinary('1010 0000'),
    flushTXFifo: decodeBinary('1110 0001'),
    flushRXFifo: decodeBinary('1110 0010'),
    reuseTXPayload: decodeBinary('1110 0011'), // PTX Device only
    readRXPayloadFIFO: decodeBinary('0110 0000'),
    writeWithACK: decodeBinary('1010 1000'),
    writeNoACK: decodeBinary('1011 0000'), // disable ack for single package
    noOperation: decodeBinary('1111 1111'),
  },
  addresses: {
    configRead: 0x00,
    EN_RXADDR: 0x02,
    txAddress: 0x10,
    P0Address: 0x0A,
    P1Address: 0x0B,
    P0Data: 0x11,
    P1Data: 0x12,
    status: 0x07,
    fifoStatus: 0x17,
    payloadP1: 0x12,
    ENAP0: 0x01,
    channel: 0x05,
    features: 0x1D,
    DYNPD: 0x1C
  },
  cmdLocation: {
    power: 1,
    rx: 0,
    maxRT: 4,
    TX_DS: 5,
    TX_FIFO_FULL: 0,
    RX_FIFO_FULL: 6,
    dynamicPayloadLength: 2,
    dynamicP0: 0,
    dynamicP1: 1
  }
}
