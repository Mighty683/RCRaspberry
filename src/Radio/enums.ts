function decodeBinary(string: string): number {
  return parseInt(string.replace(" ", ""), 2);
}

export default {
  commandCode: {
    readRegisters: 0x00,
    writeRegisters: decodeBinary("0010 0000"),
    readRXPayload: decodeBinary("0110 0001"),
    readRXWidth: decodeBinary("0110 0000"),
    writeTXPayload: decodeBinary("1010 0000"),
    flushTXFifo: decodeBinary("1110 0001"),
    flushRXFifo: decodeBinary("1110 0010"),
  },
  registerAddresses: {
    CONFIG: 0x00,
    EN_RXADDR: 0x02,
    RF_SETUP: 0x06,
    TX_ADDRESS: 0x10,
    P0_ADDRESS: 0x0a,
    P0_BYTE_DATA_LENGTH: 0x11,
    STATUS: 0x07,
    FIFO_STATUS: 0x17,
    CHANNEL: 0x05,
  },
  bitLocation: {
    POWER: 1,
    RX: 0,
    MAX_RT: 4,
    TX_DS: 5,
    RF_DR_LOW: 5,
    RF_DR_HIGH: 3,
    TX_FIFO_FULL: 0,
    RX_FIFO_ACTIVE: 6,
  },
};
