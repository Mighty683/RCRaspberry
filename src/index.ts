import dot from "dotenv";

import { startReceiver } from "./receiver";
import { startTransmitter } from "./transmitter";

dot.config();

const ADDRESS = 0xffffff;
const spi = process.env.RADIO_SPI || "/dev/spidev0.0";
const ce = (process.env.RADIO_CE && parseInt(process.env.RADIO_CE)) || 22;

async function start() {
  try {
    if (process.env.IS_TRANSMITTER) {
      await startTransmitter(ADDRESS, spi, ce);
    } else {
      await startReceiver(ADDRESS, spi, ce);
    }
  } catch (e) {
    console.error(e);
  }
}

start();
