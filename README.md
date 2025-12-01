# Ball Balancer Web Interface

[Web page](https://jasonz-utc.github.io)



This site uses the WebSerial API [(see compatible browsers)](https://caniuse.com/web-serial) to connect to a Teensy 4.1.
- The Teensy defaults to Standalone mode, which places the ball at 0,0.
- In Remote mode, the ball can be dragged around with the mouse, and new set points will be sent to the Teensy in real time.
- In Pattern mode, the ball's trajectory can be drawn on to the canvas then played back.
- Init mode resets the platform to it's starting position, then switches to Standalone automatically.
- Pause mode allows PID coefficients to be set using the syntax "kp 0.1" "ki 0.2" "kd 0.3"
