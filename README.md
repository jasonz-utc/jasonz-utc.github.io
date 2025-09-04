# Ball Balancer Web Interface

[Web page](https://jasonz-utc.github.io)

## Planned Features

- Live position tracking/visualization
- PID parameter tuning
- Ball pattern gallery
- Custom pattern drawing

## Under the Hood

This site uses the WebSerial API [(see compatible browsers)](https://caniuse.com/web-serial) to connect to a Teensy 4.1.
We plan on implementing the following commands:

- getPos
- setTarget x y
- getPID
- setPID P I D
- getMode
- setMode mode
  
Communication will be handled programatically, but these commands can still be used with any serial terminal for debug.
The visualization refresh rate will be dictated by the performance of the Teensy, but we hope to achieve at least 30Hz.
