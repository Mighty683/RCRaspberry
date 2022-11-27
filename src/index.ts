import dot from 'dotenv';
import { startReceiver } from "./receiver";
import { startTrasmitter } from "./transmitter";

dot.config();

const ADDRESS = 0xa2a3a1a1a1;
const spi = process.env.RADIO_SPI;
const ce = process.env.RADIO_CE && parseInt(process.env.RADIO_CE);

if (process.env.IS_TRANSMITTER) {
  startTrasmitter(ADDRESS, spi, ce);
} else {
  startReceiver(ADDRESS, spi ,ce);
}
