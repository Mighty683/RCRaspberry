"use strict";

import { EventEmitter } from "events";

import SPI from "pi-spi";
import type { SPI as SPIInterface } from "pi-spi";
import rpio from "rpio";

import Enums from "./enums";

export class Radio extends EventEmitter {
  private _RX_INTERVAL: NodeJS.Timer;
  private spi: SPIInterface;
  private readonly cePin: number;
  private readonly spiAddress: string;
  private readonly registers: Record<number, number> = {};
  private _ce: number;

  /**
   * Init connection with controller.
   */
  async init(): Promise<void> {
    rpio.init();
    rpio.open(this.cePin, rpio.OUTPUT, rpio.LOW);
    this._ce = rpio.LOW;
    this.spi = SPI.initialize(this.spiAddress);
    await this.waitTime(100);
    await this.readRegister(Enums.registerAddresses.CONFIG);
    await this.powerUP();
    await this.waitTime(5);
    this.log(`INITIALIZED RADIO ON ${this.spiAddress} and CE pin ${this.cePin}`);
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
  /**
   * Enable transmitter mode
   */
  async initTX(transmitterAddress: number): Promise<void> {
    await this.setTX();
    await this.writeRegister(Enums.registerAddresses.TX_ADDRESS, transmitterAddress);
    await this.writeRegister(Enums.registerAddresses.P0Address, transmitterAddress);
    await this.setCE(1);
    this.log("TX INITIALIZED");
  }

  /**
   * Enable receiver mode.
   */
  async initRX(receiverAddress: number): Promise<void> {
    await this.writeRegister(Enums.registerAddresses.P0Address, receiverAddress);
    await this.writeRegister(Enums.registerAddresses.P0Data, 0x20);
    await this.setRX();
    await this.setCE(1);
    await this.writeRegister(Enums.registerAddresses.P0Data, 4);
    this._RX_INTERVAL = setInterval(async () => {
      const statusRegister = await this.readRegister(Enums.registerAddresses.STATUS);

      const rxDataPresent = statusRegister & (1 << Enums.bitLocation.RX_FIFO_ACTIVE);
      if (rxDataPresent) {
        await this.writeRegister(
          Enums.registerAddresses.STATUS,
          1 << Enums.bitLocation.RX_FIFO_ACTIVE
        );
        const packetsReceived = await this.read(4);
        await this.command(Enums.commandCode.flushRXFifo);
        this.log("Data received", parseData(packetsReceived));
        this.emit("response:received", parseData(packetsReceived));
      }
      if (!this.isRX()) {
        clearInterval(this._RX_INTERVAL);
      }
    }, 10);
    this.log("RX INITIALIZED");
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
      const writeArray = transformToTransportArray(cmd);
      const data = options && options.data;
      const readBufferLength = options && options.readBufferLength;
      const writeBuffer = data
        ? Buffer.from(writeArray.concat(transformToTransportArray(data)))
        : Buffer.from(writeArray);

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

  /**
   * Trasmit/Receive data section
   */
  async transmit(dataToTransmit: string | number[]): Promise<Buffer> {
    let transportArray: number[];
    if (typeof dataToTransmit === "string") {
      transportArray = dataToTransmit.split("").map((char) => char.charCodeAt(0));
    } else {
      transportArray = dataToTransmit;
    }
    if (transportArray.length > 0 && !this.isRX()) {
      if (!this.cePin) {
        await this.setCE(1);
      }
      const statusRegister = await this.readRegister(Enums.registerAddresses.STATUS);
      const operations: (() => Promise<unknown>)[] = [];
      const maxRetransmit = statusRegister & (1 << Enums.bitLocation.maxRT);
      const txFifoFull = statusRegister & (1 << Enums.bitLocation.TX_FIFO_FULL);
      const ackReceived = statusRegister & (1 << Enums.bitLocation.TX_DS);

      if (maxRetransmit) {
        /**
         * Max RT bit has to be cleared on limit reach to enable further transmittion
         */
        this.log("Max retransmit limit reached!");
        operations.push(() =>
          this.writeRegister(Enums.registerAddresses.STATUS, 1 << Enums.bitLocation.maxRT)
        );
      }
      if (txFifoFull) {
        this.log("TX fifo full!");
        operations.push(() => this.command(Enums.commandCode.flushTXFifo));
      }
      if (ackReceived) {
        this.log("ACK Received!");
      }
      if (operations.length > 0) {
        for (const operation of operations) {
          await operation();
        }
      } else {
        return this.write(
          transportArray.reduce((value, currentValue) => (value << 8) + currentValue, 0)
        );
      }
    }
  }

  async read(length: number): Promise<number[]> {
    const responseBuffer = await this.command(Enums.commandCode.readRXPayload, {
      readBufferLength: length + 1,
    });

    this.log("READ:", responseBuffer.toJSON());

    return Array.from(responseBuffer.values()).slice(1);
  }

  write(data: number): Promise<Buffer> {
    return this.command(Enums.commandCode.writeTXPayload, {
      data,
    });
  }

  /*

  RX/TX Group

  */

  async setRX(): Promise<void> {
    const set = this.setBitHigh(
      this.registers[Enums.registerAddresses.CONFIG],
      Enums.bitLocation.rx
    );
    await this.writeRegister(Enums.registerAddresses.CONFIG, set);
  }

  async setTX(): Promise<void> {
    const set = this.setBitLow(
      this.registers[Enums.registerAddresses.CONFIG],
      Enums.bitLocation.rx
    );
    await this.writeRegister(Enums.registerAddresses.CONFIG, set);
  }

  isRX(): boolean {
    return (this.registers[Enums.registerAddresses.CONFIG] & (1 << Enums.bitLocation.rx)) != 0;
  }

  /*

  Main register group: power up and down has to be the same as setState

  */

  isPowered(): boolean {
    return (this.registers[Enums.registerAddresses.CONFIG] & (1 << Enums.bitLocation.power)) != 0;
  }

  async powerUP(): Promise<void> {
    const configRegisterState = this.setBitHigh(
      this.registers[Enums.registerAddresses.CONFIG],
      Enums.bitLocation.power
    );
    await this.writeRegister(Enums.registerAddresses.CONFIG, configRegisterState);
  }

  async powerDown(): Promise<void> {
    const configRegisterState = this.setBitLow(
      this.registers[Enums.registerAddresses.CONFIG],
      Enums.bitLocation.power
    );
    await this.writeRegister(Enums.registerAddresses.CONFIG, configRegisterState);
  }

  async readRegister(registerAddress: number): Promise<number> {
    const registerState = await this.command(Enums.commandCode.readRegisters | registerAddress, {
      readBufferLength: 2,
    });

    this.registers[registerAddress] = registerState.values().next().value;
    return this.registers[registerAddress];
  }

  async writeRegister(registerToWrite: number, data: number): Promise<number> {
    await this.command(Enums.commandCode.writeRegisters | registerToWrite, {
      data,
    });

    this.registers[registerToWrite] = data;

    return this.registers[registerToWrite];
  }

  pulseCE(): void {
    rpio.write(this.cePin, 0);
    rpio.write(this.cePin, 1);
    rpio.write(this.cePin, 0);
  }

  setCE(state: number): Promise<number> {
    return new Promise((resolve) => {
      if (state !== this._ce) {
        rpio.write(this.cePin, state);
        this._ce = state;
        resolve(this._ce);
      } else {
        resolve(this._ce);
      }
    });
  }

  waitTime(time: number): Promise<void> {
    return new Promise((resolve) => {
      setTimeout(resolve, time);
    });
  }

  log(...args: unknown[]): void {
    if (process.env.ENABLE_DEBUGGER) {
      console.log(...args);
    }
  }

  setBitHigh(source: number, location: number): number {
    return source | (1 << location);
  }

  setBitLow(source: number, location: number): number {
    return source & ~(1 << location);
  }

  constructor(spi = "/dev/spidev0.0", cePin = 22) {
    super();
    this.cePin = cePin;
    this.spiAddress = spi;
  }
}

function parseData(data) {
  return data.map((charCode) => String.fromCharCode(charCode)).join("");
}

function transformToTransportArray(number: number) {
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
