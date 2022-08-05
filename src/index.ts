import { startReceiver } from "./receiver";
import { startTrasmitter } from "./transmitter";

const ADDRESS = 0xa2a3a1a1a1;
if (process.env.IS_TRANSMITTER) {
  startTrasmitter(ADDRESS);
} else {
  startReceiver(ADDRESS);
}
