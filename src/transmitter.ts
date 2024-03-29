import { Radio } from "./Radio";

export async function startTransmitter(address: number, spi: string, ce: number): Promise<void> {
  console.log("Starting trasmitter");
  const radio = new Radio(spi, ce);
  await radio.initialize();
  await radio.enableTransmitterMode(address);

  process.stdin.setRawMode(true);
  process.stdin.resume();
  process.stdin.setEncoding("utf8");
  process.stdin.on("data", async function (key: string) {
    let command = "0000";
    if (key === "\u0003") {
      process.exit();
    }
    if (key === "\u001b[A") {
      command = "0+10";
    }
    if (key === "\u001b[B") {
      command = "0-10";
    }
    if (key === "\u001b[D") {
      command = "1+10";
    }
    if (key === "\u001b[C") {
      command = "1-10";
    }
    if (key === "w") {
      command = "0U05";
    }
    if (key === "s") {
      command = "0D05";
    }
    if (key === "a") {
      command = "1U05";
    }
    if (key === "d") {
      command = "1D05";
    }
    if (key === "z") {
      command = "E+00";
    }
    if (key === "x") {
      command = "E-00";
    }
    if (key === "o") {
      command = "E000";
    }

    try {
      const success = await radio.transmit(command);
      if (success) {
        console.log("Transmitted:", command);
      } else {
        console.log(`Transmition for command ${command} failed!`);
      }
    } catch (e) {
      console.error(e);
    }
  });
}
