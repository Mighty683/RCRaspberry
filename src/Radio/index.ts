"use strict";

import { EventEmitter } from "events";

import SPI from "pi-spi";
import type { SPI as SPIInterface } from "pi-spi";
import rpio, { writebuf } from "rpio";

import Enums from "./enums";

export class Radio extends EventEmitter {
  private rxInterval: NodeJS.Timer;
  private spi: SPIInterface;
  private cePinState: number;

  private readonly CEPinNumber: number;
  private readonly SPIAddress: string;

  async initializeConnectionWithRadio(): Promise<void> {
    rpio.init();
    rpio.open(this.CEPinNumber, rpio.OUTPUT, rpio.LOW);
    this.cePinState = rpio.LOW;
    this.spi = SPI.initialize(this.SPIAddress);
    await this.powerUp();
    this.log(`INITIALIZED RADIO ON ${this.SPIAddress} and CE pin ${this.CEPinNumber}`);
  }

  async setDataRate(): Promise<void> {
    await this.writeRegister(
      Enums.registerAddresses.RF_SETUP,
      this.setBitLow(
        this.setBitHigh(
          await this.readRegister(Enums.registerAddresses.RF_SETUP),
          Enums.bitLocation.RF_DR_LOW
        ),
        Enums.bitLocation.RF_DR_HIGH
      )
    );
  }

  async enableTransmitterMode(transmitterAddress: number): Promise<void> {
    await this.writeRegister(Enums.registerAddresses.TX_ADDRESS, transmitterAddress);
    await this.setTX();
    await this.powerUp();
    this.log("TX MODE INITIALIZED");
  }

  async enableReceiverMode(receiverAddress: number): Promise<void> {
    await this.writeRegister(Enums.registerAddresses.P0_ADDRESS, receiverAddress);
    await this.writeRegister(Enums.registerAddresses.P0_BYTE_DATA_LENGTH, 12);
    await this.setRX();
    await this.powerUp();
    await this.setCE(1);
    this.rxInterval = setInterval(() => this.readDataIntervalCallback(), 10);
    this.log("RX MODE INITIALIZED");
  }
  private async readDataIntervalCallback() {
    if (!(await this.isRX())) {
      this.log("Disabling RX interval");
      return clearInterval(this.rxInterval);
    }
    const statusRegister = await this.readRegister(Enums.registerAddresses.STATUS);
    const rxDataPresent = statusRegister & (1 << Enums.bitLocation.RX_FIFO_ACTIVE);
    if (rxDataPresent) {
      await this.writeRegister(
        Enums.registerAddresses.STATUS,
        1 << Enums.bitLocation.RX_FIFO_ACTIVE
      );
      const packetsReceived = await this.read(4);
      await this.command(Enums.commandCode.flushRXFifo);
      this.log("Data received", this.parseData(packetsReceived));
      this.emit("response:received", this.parseData(packetsReceived));
    }
  }

  /**
   * Send command to controller
   * @param {*} cmd
   * @param {*} options
   */
  command(
    cmd: number,
    options?: {
      readBufferLength?: number;
      data?: number;
    }
  ): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const writeBuffer = Buffer.from([
        cmd,
        ...(options?.data ? this.transformToTransportArray(options.data) : []),
      ]);
      const readBufferLength = options && options.readBufferLength;

      if (readBufferLength) {
        this.spi.transfer(writeBuffer, readBufferLength, function (err, data) {
          if (err) {
            reject(err);
          } else {
            resolve(data);
          }
        });
      } else {
        this.spi.transfer(writeBuffer, function (err, data) {
          if (err) {
            reject(err);
          } else {
            resolve(data);
          }
        });
      }
    });
  }

  async transmit(dataToTransmit: string): Promise<Buffer> {
    if (await this.isRX()) {
      throw new Error("Cannot transmit in RX mode");
    }

    await this.transmitPreCheck();

    const transportArray = dataToTransmit.split("").map((char) => char.charCodeAt(0));
    const result = await this.sendData(
      transportArray.reduce((value, currentValue) => (value << 8) + currentValue, 0)
    );
    await this.setCE(1);

    return result;
  }

  async transmitPreCheck(): Promise<void> {
    const statusRegisterState = await this.readRegister(Enums.registerAddresses.STATUS);
    const maxRetransmit = this.readBit(statusRegisterState, Enums.bitLocation.MAX_RT);
    const txFifoFull = this.readBit(statusRegisterState, Enums.bitLocation.TX_FIFO_FULL);

    if (maxRetransmit) {
      await this.clearMaxRetransmit();
    }

    if (txFifoFull) {
      await this.flushTXFifo();
    }
  }

  private async flushTXFifo() {
    this.log("Flushing TX fifo");
    await this.command(Enums.commandCode.flushTXFifo);
  }

  private async clearMaxRetransmit() {
    this.log("Clearing MAX_RT bit!");
    await this.writeRegister(Enums.registerAddresses.STATUS, 1 << Enums.bitLocation.MAX_RT);
  }

  async read(length: number): Promise<number[]> {
    const responseBuffer = await this.command(Enums.commandCode.readRXPayload, {
      readBufferLength: length + 1,
    });

    this.log("READ:", responseBuffer.toJSON());

    return Array.from(responseBuffer.values()).slice(1);
  }

  sendData(data: number): Promise<Buffer> {
    return this.command(Enums.commandCode.writeTXPayload, {
      data,
    });
  }

  /*
    RX/TX Group
  */

  async setRX(): Promise<void> {
    await this.writeRegister(
      Enums.registerAddresses.CONFIG,
      this.setBitHigh(await this.readRegister(Enums.registerAddresses.CONFIG), Enums.bitLocation.RX)
    );
  }

  async setTX(): Promise<void> {
    await this.writeRegister(
      Enums.registerAddresses.CONFIG,
      this.setBitLow(await this.readRegister(Enums.registerAddresses.CONFIG), Enums.bitLocation.RX)
    );
  }

  async isRX(): Promise<boolean> {
    return !!this.readBit(
      await this.readRegister(Enums.registerAddresses.CONFIG),
      Enums.bitLocation.RX
    );
  }

  async powerDown(): Promise<void> {
    await this.command(Enums.commandCode.writeRegisters | Enums.registerAddresses.CONFIG, {
      data: this.setBitLow(
        await this.readRegister(Enums.registerAddresses.CONFIG),
        Enums.bitLocation.POWER
      ),
    });
  }

  async powerUp(): Promise<void> {
    await this.command(Enums.commandCode.writeRegisters | Enums.registerAddresses.CONFIG, {
      data: this.setBitHigh(
        await this.readRegister(Enums.registerAddresses.CONFIG),
        Enums.bitLocation.POWER
      ),
    });
    await this.waitTime(100);
  }

  async readRegister(registerAddress: number, registerSize = 2): Promise<number> {
    const registerState = await this.command(Enums.commandCode.readRegisters | registerAddress, {
      readBufferLength: registerSize,
    });
    const response = registerState.at(1);

    this.logVerbose(
      `READ register ${Object.keys(Enums.registerAddresses).find(
        (key) => Enums.registerAddresses[key] === registerAddress
      )}: ${response.toString(2)}`
    );

    return response;
  }

  async writeRegister(registerToWrite: number, data: number): Promise<number> {
    await this.setCE(0);
    await this.waitTime(1);
    this.logVerbose(
      `WRITE register ${Object.keys(Enums.registerAddresses).find(
        (key) => Enums.registerAddresses[key] === registerToWrite
      )}: ${data.toString(2)}`
    );
    await this.command(Enums.commandCode.writeRegisters | registerToWrite, {
      data,
    });
    await this.setCE(1);
    await this.waitTime(1);
    return this.readRegister(registerToWrite);
  }

  setCE(state: number): Promise<number> {
    return new Promise((resolve) => {
      if (state !== this.cePinState) {
        rpio.write(this.CEPinNumber, state);
        this.cePinState = state;
        resolve(this.cePinState);
      } else {
        resolve(this.cePinState);
      }
    });
  }

  waitTime(time: number): Promise<void> {
    return new Promise((resolve) => {
      setTimeout(resolve, time);
    });
  }

  log(...args: unknown[]): void {
    if (process.env.LOG_LEVEL) {
      console.log(...args);
    }
  }

  logVerbose(...args: unknown[]): void {
    if (process.env.LOG_LEVEL === "verbose") {
      this.log(...args);
    }
  }

  readBit(source: number, location: number): number {
    return source & (1 << location);
  }

  setBitHigh(source: number, location: number): number {
    return source | (1 << location);
  }

  setBitLow(source: number, location: number): number {
    return source & ~(1 << location);
  }

  parseData(data: number[]): string {
    return data.map((charCode) => String.fromCharCode(charCode)).join("");
  }

  transformToTransportArray(number: number): number[] {
    const array = [];
    let string = number.toString(16);
    if (string.length % 2 === 1) {
      string = "0" + string;
    }
    for (let i = 0; i < string.length; i += 2) {
      array.push(string[i] + string[i + 1]);
    }
    return array.map((e) => parseInt(e, 16));
  }

  constructor(spiAddress: string, CEPinNumber: number) {
    super();
    this.CEPinNumber = CEPinNumber;
    this.SPIAddress = spiAddress;
  }
}
