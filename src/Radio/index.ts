"use strict";

import { EventEmitter } from "events";

import SPI from "pi-spi";
import type { SPI as SPIInterface } from "pi-spi";
import rpio from "rpio";

import Enums from "./enums";

export type SpeedMode = "HIGH_SPEED" | "LOW_SPEED";

export declare interface Radio {
  on(event: "response:received", listener: (data: string) => void): this;
}
export class Radio extends EventEmitter {
  private rxInterval: NodeJS.Timer;
  private spi: SPIInterface;
  private cePinState: number;

  private readonly speedMode: SpeedMode;
  private readonly CEPinNumber: number;
  private readonly SPIAddress: string;

  constructor(spiAddress: string, CEPinNumber: number, mode: SpeedMode = "LOW_SPEED") {
    super();
    this.speedMode = mode;
    this.CEPinNumber = CEPinNumber;
    this.SPIAddress = spiAddress;
  }

  public async initialize(): Promise<void> {
    rpio.init();
    rpio.open(this.CEPinNumber, rpio.OUTPUT, rpio.LOW);
    this.cePinState = rpio.LOW;
    this.spi = SPI.initialize(this.SPIAddress);
    await this.powerUp();
    await this.setDataRate(this.speedMode);
    this.log(
      `INITIALIZED RADIO ON ${this.SPIAddress} and CE pin ${this.CEPinNumber} with ${this.speedMode}`
    );
  }

  public async enableTransmitterMode(transmitterAddress: number): Promise<void> {
    await this.writeRegister(Enums.registerAddresses.TX_ADDRESS, transmitterAddress);
    await this.writeRegister(Enums.registerAddresses.P0_ADDRESS, transmitterAddress);

    await this.flushTXFifo();
    await this.clearMaxRetransmit();
    await this.clearAck();

    await this.setTX();
    await this.powerUp();
    this.log("TX MODE INITIALIZED");
  }

  public async enableReceiverMode(receiverAddress: number): Promise<void> {
    await this.writeRegister(Enums.registerAddresses.P0_ADDRESS, receiverAddress);
    await this.writeRegister(Enums.registerAddresses.P0_BYTE_DATA_LENGTH, 4);
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
      const packetsReceived = await this.readData(4);
      await this.command(Enums.commandCode.flushRXFifo);
      this.log("Data received", this.parseData(packetsReceived));
      this.emit("response:received", this.parseData(packetsReceived));
    }
  }

  public async transmit(dataToTransmit: string): Promise<boolean> {
    if (await this.isRX()) {
      throw new Error("Cannot transmit in RX mode");
    }

    await this.transmitDataRegisterClear();

    const transportArray = dataToTransmit.split("").map((char) => char.charCodeAt(0));
    await this.sendData(transportArray.reduce((acc, byte) => (acc << 8) + byte, 0));
    await this.setCE(1);
    await this.waitTime(4);
    await this.setCE(0);

    if (this.speedMode === "HIGH_SPEED") {
      return this.checkAck();
    } else {
      return true;
    }
  }

  private async checkAck() {
    const receivedAcknowledge = !!this.readBit(
      await this.readRegister(Enums.registerAddresses.STATUS),
      Enums.bitLocation.TX_DS
    );

    await this.clearAck();

    return receivedAcknowledge;
  }

  private async transmitDataRegisterClear() {
    await this.flushTXFifo();
    await this.clearMaxRetransmit();
  }

  private async sendData(data: number): Promise<Buffer> {
    return this.command(Enums.commandCode.writeTXPayload, {
      data,
    });
  }

  private async flushTXFifo() {
    this.log("Flushing TX fifo");
    await this.command(Enums.commandCode.flushTXFifo);
  }

  private async clearMaxRetransmit() {
    this.log("Clearing MAX_RT bit!");
    await this.writeRegister(Enums.registerAddresses.STATUS, 1 << Enums.bitLocation.MAX_RT);
  }

  private async clearAck() {
    this.log("Clearing Ack bit!");
    await this.writeRegister(Enums.registerAddresses.STATUS, 1 << Enums.bitLocation.TX_DS);
  }

  private async readData(length: number): Promise<number[]> {
    const responseBuffer = await this.command(Enums.commandCode.readRXPayload, {
      readBufferLength: length + 1,
    });

    return Array.from(responseBuffer.values()).slice(1);
  }

  private async setRX(): Promise<void> {
    await this.writeRegister(
      Enums.registerAddresses.CONFIG,
      this.setBitHigh(await this.readRegister(Enums.registerAddresses.CONFIG), Enums.bitLocation.RX)
    );
  }

  private async setTX(): Promise<void> {
    await this.writeRegister(
      Enums.registerAddresses.CONFIG,
      this.setBitLow(await this.readRegister(Enums.registerAddresses.CONFIG), Enums.bitLocation.RX)
    );
  }

  private async isRX(): Promise<boolean> {
    return !!this.readBit(
      await this.readRegister(Enums.registerAddresses.CONFIG),
      Enums.bitLocation.RX
    );
  }

  private async powerDown(): Promise<void> {
    await this.command(Enums.commandCode.writeRegisters | Enums.registerAddresses.CONFIG, {
      data: this.setBitLow(
        await this.readRegister(Enums.registerAddresses.CONFIG),
        Enums.bitLocation.POWER
      ),
    });
  }

  private async powerUp(): Promise<void> {
    await this.command(Enums.commandCode.writeRegisters | Enums.registerAddresses.CONFIG, {
      data: this.setBitHigh(
        await this.readRegister(Enums.registerAddresses.CONFIG),
        Enums.bitLocation.POWER
      ),
    });
    await this.waitTime(100);
  }

  private async readRegister(registerAddress: number, registerSize = 1): Promise<number> {
    const readCommandResponse = await this.command(
      Enums.commandCode.readRegisters | registerAddress,
      {
        readBufferLength: registerSize + 1,
      }
    );

    const response = Array.from(readCommandResponse)
      .slice(1)
      .reduce((acc, byte) => (acc << 8) + byte, 0);

    this.logVerbose(
      `READ register ${Object.keys(Enums.registerAddresses).find(
        (key) => Enums.registerAddresses[key] === registerAddress
      )}: ${response.toString(2)}`
    );

    return response;
  }

  private async writeRegister(registerToWrite: number, data: number): Promise<number> {
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

  private setCE(state: number): Promise<number> {
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

  private async setDataRate(speedMode: SpeedMode): Promise<void> {
    if (speedMode === "HIGH_SPEED") {
      await this.writeRegister(
        Enums.registerAddresses.RF_SETUP,
        this.setBitHigh(
          this.setBitLow(
            await this.readRegister(Enums.registerAddresses.RF_SETUP),
            Enums.bitLocation.RF_DR_LOW
          ),
          Enums.bitLocation.RF_DR_HIGH
        )
      );
    } else {
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
    console.log(await (await this.readRegister(Enums.registerAddresses.RF_SETUP)).toString(2));
  }

  private command(
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

  private waitTime(time: number): Promise<void> {
    return new Promise((resolve) => {
      setTimeout(resolve, time);
    });
  }

  private log(...args: unknown[]): void {
    if (process.env.LOG_LEVEL && process.env.LOG_LEVEL !== "none") {
      console.log(...args);
    }
  }

  private logVerbose(...args: unknown[]): void {
    if (process.env.LOG_LEVEL === "verbose") {
      this.log(...args);
    }
  }

  private readBit(source: number, location: number): number {
    return source & (1 << location);
  }

  private setBitHigh(source: number, location: number): number {
    return source | (1 << location);
  }

  private setBitLow(source: number, location: number): number {
    return source & ~(1 << location);
  }

  private parseData(data: number[]): string {
    return data.map((charCode) => String.fromCharCode(charCode)).join("");
  }

  private transformToTransportArray(number: number): number[] {
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
}
