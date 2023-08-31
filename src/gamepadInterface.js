const isLocaldev = window.location.href.indexOf('localhost') !== -1;
if (isLocaldev) console.log("gamepadInterface.js loaded");

class GamepadInterface extends EventTarget {
  #doDebug = false;
  #stop = false;
  #cfg = {};
  #autoReconnect = true;

  #oldGpState;
  #gpIndex;

  // How long a button must be held down for 
  // it to be considered a ".Hold" event.
  #holdMs = 300; 
  #stickDeadzone = 0.3;

  // Due to how the Gamepad object works,
  // index order of this array is important.
  // for proper function
  #buttonsArr = [
    'a', 'b', 'x', 'y',
    'lb', 'rb', 'lt', 'rt',
    'back', 'start',
    'l3','r3',
    'up', 'down', 'left', 'right',
    'center'
  ];

  #timeStamps = {
    // Example key/value:
    // 'a.Down' : timeStamp
  };

  #btnEvts = {
    DOWN: '.Down',
    UP: '.Up',
    PRESS: '.Press',
    HOLD: '.Hold',
    HOLD_RELEASE: '.HoldRelease'
  };


  constructor(config, opt_gamepad) {
    super();
    this.setConfig(config);
    
    if (this.#cfg.doDebug !== undefined)       this.#doDebug = this.#cfg.doDebug;
    if (this.#cfg.holdMs !== undefined)        this.#holdMs = this.#cfg.holdMs;
    if (this.#cfg.stickDeadzone !== undefined) this.#stickDeadzone = this.#cfg.stickDeadzone;

    if (opt_gamepad) {
      // If we already have a gamepad, use it...
      this.#setupGamepad(opt_gamepad);
    } else {
      // ... Otherwise, set up listeners for 'gamepadconnected'
      this.#listenForConnected();
    }


    this.#init();
  }

  // For setting a new configuration.
  // e.g. Switching from gameplay to a UI menu.
  setConfig(config) {
    if (config.doDebug) console.log('config ::', config);
    this.#cfg = config;
  }

  // Gets a fresh state from the current gamepad.
  getGamepad() {
    const currGamepad = navigator.getGamepads ? navigator.getGamepads()[this.#gpIndex] : 
        (navigator.webkitGetGamepads ? navigator.webkitGetGamepads()[[this.#gpIndex]] : []);

    return currGamepad;
  }

  #init() {
    this.#buttonsArr.forEach((btnName) => {
      // Create all GamepadEvent event names by combining button names and event types.
      // e.g. a.Down, rb.Up, l3.Hold, start.HoldRelease etc
      const btnEventNames = Object.values(this.#btnEvts).map(evtName => {
        return btnName + evtName; 
      });

      // Listen for all button events.
      btnEventNames.forEach((name) => {
        this.addEventListener(name, this.#handleBtnEvent);
      })
    });

    if (this.getGamepad() !== undefined) {
      // Start the monitoring loop
      this.#monitoringLoop();
    }
  }



  /* ---

    Handle gamepad connected and disconnected events.

  --- */
  #boundOnGamepadConnectedHandler = this.#onGamepadConnected.bind(this);
  #boundOnGamepadDisconnectedHandler = this.#onGamepadDisconnected.bind(this);

  #listenForConnected() {
    window.addEventListener("gamepadconnected", this.#boundOnGamepadConnectedHandler);
  }

  #onGamepadConnected(e) {
    const gamepad = navigator.getGamepads()[e.gamepad.index];
    if (gamepad) {
      this.#setOldGamepadState(gamepad);
      this.#setGamepadIndex(e.gamepad.index);
      this.#monitoringLoop();
    }

    window.removeEventListener("gamepadconnected", this.#boundOnGamepadConnectedHandler);
    window.addEventListener("gamepaddisconnected", this.#boundOnGamepadDisconnectedHandler);
  }

  #onGamepadDisconnected(e) {
    // Tear down existing GamepadInterface instance.
    this.disconnect(e);

    if (this.#autoReconnect) {
      this.#listenForConnected();
    }
  }



  /* ---

    Handle gamepad states

  --- */
  #setupGamepad(gp) {
    this.#setOldGamepadState(gp);
    this.#setGamepadIndex(gp.index);
  }

  #setGamepadIndex(idx) {
    this.#gpIndex = idx;
  }

  #setOldGamepadState(gp) {
    this.#oldGpState = gp;
  }



  /* ---

    Handle monitoring loop

  --- */
  #monitoringLoop() {
    requestAnimationFrame(this.#handleUpdate.bind(this));
  }

  #handleUpdate(timestamp) {
    if (this.#stop) return; // Cancel loop and go dormant

    // Get a new snapshop of the gamepad state
    const gp = this.getGamepad();

    this.#checkButtons(gp);
    this.#checkSticks(gp);

    // Cache the current state to check for changes on next loop
    this.#setOldGamepadState(gp);

    // Continue the loop
    this.#monitoringLoop();
  }



  /* ---

    Handle buttons

  --- */
  #checkButtons(gp) {
    this.#buttonsArr.forEach((btnName) => {
      const isPressed = this.isPressed(btnName, gp);
      const wasPressed = this.#wasPressed(btnName);
      
      // For "Hold" event triggering
      const wentDownTimeStamp = this.#timeStamps[btnName + this.#btnEvts.DOWN];
      const holdTimeStamp = this.#timeStamps[btnName + this.#btnEvts.HOLD]

      let timeSinceDown;
      
      if (isPressed && !wasPressed) {
        // Button just went Down
        this.dispatchEvent(new GamepadEvent(btnName + this.#btnEvts.DOWN));

      } else if (!isPressed && wasPressed) {
        // Button just went Up
        this.dispatchEvent(new GamepadEvent(btnName + this.#btnEvts.UP));

        // Check if this is a quick "Pressed" event
        if (timeSinceDown && timeSinceDown < this.#holdMs) {
          this.dispatchEvent(new GamepadEvent(btnName + this.#btnEvts.PRESS));
        }

        // Button also just went Up from Hold
        if (this.#timeStamps[btnName + this.#btnEvts.HOLD]) {
          this.dispatchEvent(new GamepadEvent(btnName + this.#btnEvts.HOLD_RELEASE));
        }

      } else if (isPressed && wasPressed && !holdTimeStamp) {        
        // Button is in Hold State, but we check #timeStamps to make sure we only trigger the "Hold" event once.
        timeSinceDown = (wentDownTimeStamp) ? performance.now() - wentDownTimeStamp : null;

        // Test timeSinceDown to determine if a button is in 'Hold' state
        if (timeSinceDown && timeSinceDown > this.#holdMs) {
          this.dispatchEvent(new GamepadEvent(btnName + this.#btnEvts.HOLD));
        }
      }
    });
  }

  // Example events: 'a.Down', 'lt.Up', 'rt.Hold' etc
  #handleBtnEvent(e) {
    if (this.#doDebug) console.log('handleBtnEvent ::', e.type, e.timeStamp);

    // If config passed a handler function for this ButtonEvent, call it.
    const handlerFunc = this.#getBtnHandlerFromConfig(e);
    let handlerArguments = this.#getHandlerArguments(e);
    if (handlerFunc) handlerFunc.apply(null, handlerArguments);

    this.#updateTimeStamps(e);
  }

  #getHandlerArguments(e) {
    const btnName = this.#getBtnNameFromBtnEvent(e);
    const btnEventType = this.#getBtnEvtTypeFromBtnEvent(e);

    // Temp shortcut for enum values
    const be = this.#btnEvts;

    let handlerArguments = [];

    switch (btnEventType) {
      case be.DOWN :
      case be.PRESS :
      case be.HOLD :
      case be.UP :
        return handlerArguments;

      case be.HOLD_RELEASE :
        const timeHeld = performance.now() - this.#timeStamps[btnName + be.HOLD];
        handlerArguments.push(timeHeld);

        return handlerArguments;

      default:
        return handlerArguments;
    }
  }

  #getBtnHandlerFromConfig(e) {
    return this.#cfg[e.type];
  }

  // #timeStamps keys are full event names, e.g. 'a.Down', 'y.Hold', 'x.Up'
  #updateTimeStamps(e) {
    const now = performance.now();

    const btnName = this.#getBtnNameFromBtnEvent(e);
    const btnEventType = this.#getBtnEvtTypeFromBtnEvent(e);

    // Temp shortcut for enum values
    const be = this.#btnEvts;

    // Internal tracking.
    switch (btnEventType) {
      case be.DOWN :
        this.#timeStamps[btnName + be.DOWN] = now;
        // Clear out the btnName+".Up" value for the given button.
        this.#timeStamps[btnName + be.UP] = null;
        return;

      case be.PRESS :
        // "Pressed" state is over, clear out related timestamps.
        this.#timeStamps[btnName + be.DOWN] = null;
        this.#timeStamps[btnName + be.UP] = null;
        return;

      case be.HOLD :
        // Do once on initial Hold event.
        if (this.#timeStamps[btnName + be.HOLD] != this.#timeStamps[btnName + be.DOWN]) {
          this.#timeStamps[btnName + be.HOLD] = this.#timeStamps[btnName + be.DOWN];
        }
        return;

      case be.UP :
        this.#timeStamps[btnName + be.UP] = now;
        return;

      case be.HOLD_RELEASE :
        this.#timeStamps[btnName + be.HOLD_RELEASE] = now;
        this.#timeStamps[btnName + be.HOLD] = null;
        return;

      default:
        return;
    }
  }




  /* ---

    Handle joysticks

  --- */
  #checkSticks(gp) {
    // Sticks are assumed to always be reporting position.
    this.#checkStick(gp, true);
    this.#checkStick(gp, false);
  }

  #checkStick(gp, isLeft) {
    // Set axis indexes based on which stick we're checking
    const axis1 = (isLeft) ? 0 : 2;
    const axis2 = (isLeft) ? 1 : 3;
    const handlerName = (isLeft) ? 'lStick' : 'rStick';

    const vec2 = this.#checkDeadzone([gp.axes[axis1], gp.axes[axis2]]);
    const stickHandler = this.#getStickHandlerFromConfig(handlerName);
    
    if (stickHandler) stickHandler(vec2);
  }
  
  #checkDeadzone(vec2) {
    const x = vec2[0];
    const y = vec2[1];

    const absX = Math.abs(x);
    const absY = Math.abs(y);

    const dz = this.#stickDeadzone;

    const nx = (absX > dz) ? x : 0;
    const ny = (absY > dz) ? y : 0;

    return [nx, ny];
  }


  #getStickHandlerFromConfig(handlerName) {
    return this.#cfg[handlerName];
  }



  /* ---

    Event utilities

  --- */
  #getBtnNameFromBtnEvent(e) {
    return e.type.substring(0, e.type.indexOf('.')); // return ex: 'a', 'lt', 'r3'
  }
  #getBtnEvtTypeFromBtnEvent(e) {
    return e.type.substring(e.type.indexOf('.')); // return ex: '.Down', '.Up'', '.Hold'
  }

  // opt_gp : Slight optimization.
  isPressed(btnName, opt_gp) {
    const idx = this.#getBtnIndex(btnName);
    const gamepad = opt_gp || this.getGamepad();
    return gamepad.buttons[idx].pressed;
  }
  #wasPressed(btnName) {
    const idx = this.#getBtnIndex(btnName);
    return this.#oldGpState.buttons[idx].pressed;
  }
  #getBtnIndex(btnName) {
    return this.#buttonsArr.indexOf(btnName);
  }

  disconnect(e) {
    // TODO There's probably more teardown work to do here.
    this.#stop = true;
    window.removeEventListener("gamepadconnected", this.#boundOnGamepadConnectedHandler);
    window.removeEventListener("gamepaddisconnected", this.#boundOnGamepadDisconnectedHandler);
    if (this.#doDebug) console.log("gamepad disconnected");
  }
}


