# RCRaspberry

RC Project based on nRF24L01+ transreceiver and Pi Servo Shield.

## Radio

nRF24L01+ controller

### Running on one RPI

Run one radio controller on different SPI device

```
export IS_TRANSMITTER=true
export RADIO_CE=18
export RADIO_SPI=/dev/spidev1.0
yarn start:dev
```

## Servo

Pi Servo Shield controller

### Engine

Simple rpio pwm manipulation
