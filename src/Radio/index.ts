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
  private readonly registers: Record<number, number> = {};
  private _ce: number;

  /**
   * Init connection with controller.
   */
  async init(): Promise<void> {
    await this.readRegister(Enums.addresses.configRead);
    await this.powerUP();
    await this.waitTime(5);
  }
  /**
   * Enable transmitter mode
   */
  async initTX(transmitterAddress: number): Promise<void> {
    await this.setTX();
    await this.writeRegister(Enums.addresses.txAddress, transmitterAddress);
    await this.writeRegister(Enums.addresses.P0Address, transmitterAddress);
    await this.setCE(1);
    this.log('TX INITIALIZED');
  }

  /**
   * Enable receiver mode.
   */
  async initRX(receiverAddress: number, packetLength: number): Promise<void> {
    await this.writeRegister(Enums.addresses.P1Address, receiverAddress);
    await this.writeRegister(Enums.addresses.P1Data, 0x20);
    await this.setRX();
    await this.setCE(1);
    await this.writeRegister(Enums.addresses.P1Data, packetLength);
    this._RX_INTERVAL = setInterval(async () => {
      const statusRegister = await this.readRegister(Enums.addresses.status);

      const rxDataPresent = statusRegister & (1 << Enums.cmdLocation.RX_FIFO_ACTIVE);
      if (rxDataPresent) {
        await this.writeRegister(Enums.addresses.status, 1 << Enums.cmdLocation.RX_FIFO_ACTIVE);
        const packetsReceived = await this.read(packetLength);
        await this.command(Enums.cmd.flushRXFifo);
        this.log('Data received', parseData(packetsReceived));
        this.emit("response:received", parseData(packetsReceived));
      }
      if (!this.isRX()) {
        clearInterval(this._RX_INTERVAL);
      }
    }, 10);
    this.log('RX INITIALIZED');
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
      const statusRegister = await this.readRegister(Enums.addresses.status);
      const operations = [];
      const maxRetransmit = statusRegister & (1 << Enums.cmdLocation.maxRT);
      const txFifoFull = statusRegister & (1 << Enums.cmdLocation.TX_FIFO_FULL);
      const ackReceived = statusRegister & (1 << Enums.cmdLocation.TX_DS);

      if (maxRetransmit) {
        /**
         * Max RT bit has to be cleared on limit reach to enable further transmittion
         */
        this.log("Max retransmit limit reached!");
        operations.push(() =>
          this.writeRegister(Enums.addresses.status, 1 << Enums.cmdLocation.maxRT)
        );
      }
      if (txFifoFull) {
        this.log("TX fifo full!");
        operations.push(() => this.command(Enums.cmd.flushTXFifo));
      }
      if (ackReceived) {
        this.log("ACK Received!");
      }
      if (operations.length > 0) {
        this.log("Transmittion blocked!");
        await operations.reduce((prev, curr) => {
          prev.then(curr);
        }, operations.pop()());
      } else {
        return this.write(
          transportArray.reduce((value, currentValue) => (value << 8) + currentValue, 0)
        );
      }
    }
  }

  async read(length: number): Promise<number[]> {
    const responseBuffer = await this.command(Enums.cmd.readRXPayload, {
      readBufferLength: length + 1,
    });

    this.log("READ:", responseBuffer.toJSON());

    return Array.from(responseBuffer.values()).slice(1);
  }

  write(data: number): Promise<Buffer> {
    return this.command(Enums.cmd.writeTXPayload, {
      data,
    });
  }

  /*

  RX/TX Group

  */

  async setRX(): Promise<void> {
    const set = this.registers[Enums.addresses.configRead] | (1 << Enums.cmdLocation.rx);
    await this.writeRegister(Enums.addresses.configRead, set);
  }

  async setTX(): Promise<void> {
    const set = this.registers[Enums.addresses.configRead] & ~(1 << Enums.cmdLocation.rx);
    await this.writeRegister(Enums.addresses.configRead, set);
  }

  isRX(): boolean {
    return (this.registers[Enums.addresses.configRead] & (1 << Enums.cmdLocation.rx)) != 0;
  }

  /*

  Main register group: power up and down has to be the same as setState

  */

  isPowered(): boolean {
    return (this.registers[Enums.addresses.configRead] & (1 << Enums.cmdLocation.power)) != 0;
  }

  async powerUP(): Promise<void> {
    const configRegisterState =
      this.registers[Enums.addresses.configRead] | (1 << Enums.cmdLocation.power);
    await this.writeRegister(Enums.addresses.configRead, configRegisterState);
  }

  async powerDown(): Promise<void> {
    const configRegisterState =
      this.registers[Enums.addresses.configRead] & ~(1 << Enums.cmdLocation.power);
    await this.writeRegister(Enums.addresses.configRead, configRegisterState);
  }

  async readRegister(registerAddress: number): Promise<number> {
    const registerState = await this.command(Enums.cmd.readRegisters | registerAddress, {
      readBufferLength: 2,
    });

    this.registers[registerAddress] = registerState.values().next().value;
    return this.registers[registerAddress];
  }

  async writeRegister(registerToWrite: number, data: number): Promise<number> {
    await this.command(Enums.cmd.writeRegisters | registerToWrite, {
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

  log(...args): void {
    if (process.env.ENABLE_DEBUGGER) {
      console.log(args);
    }
  }

  constructor(spi = "/dev/spidev0.0", cePin = 22) {
    super();
    this.cePin = cePin;
    this.spi = SPI.initialize(spi);
    rpio.init();
    rpio.open(this.cePin, rpio.OUTPUT, rpio.LOW);
    this._ce = rpio.LOW;
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
