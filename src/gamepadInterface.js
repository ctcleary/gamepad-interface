
const isLocaldev = window.location.href.indexOf('localhost') !== -1;
if (isLocaldev) console.log("gamepadInterface.js loaded");

let gamepadInterface;
let sampleConfig = {};

(function() {
  if (isLocaldev) {
    sampleConfig.doDebug = true;
  }

  sampleConfig.holdMs = 300;
  sampleConfig.stickDeadzone = 0.3;

  ['a', 'b', 'x', 'y',
    'rb', 'lb', 'rt', 'lt',
    'back', 'start',
    'up', 'down', 'left', 'right',
    'r3', 'l3',
    'center'].forEach((btn, i) => {
      sampleConfig[btn+'.Down'] =        () => document.getElementById(btn).classList.add('btnDown');
      sampleConfig[btn+'.Up'] =          () => document.getElementById(btn).classList.remove('btnDown');
      sampleConfig[btn+'.Hold'] =        () => document.getElementById(btn).classList.add('btnHold');
      sampleConfig[btn+'.HoldRelease'] = () => document.getElementById(btn).classList.remove('btnHold');
  });

  // Sticks are always reporting position.
  // Handlers should support receiving a Vector2.
  const stickMoveMax = 50;
  sampleConfig['lStick'] = (vec2) => {
    const ls = document.getElementById('lStick');
    ls.style.left = (stickMoveMax * vec2[0]) +'px';
    ls.style.top  = (stickMoveMax * vec2[1]) +'px';
  }
  sampleConfig['rStick'] = (vec2) => {
    const rs = document.getElementById('rStick');
    rs.style.left = (stickMoveMax * vec2[0]) +'px';
    rs.style.top  = (stickMoveMax * vec2[1]) +'px';
  }
})();

(function() {
  function onGamepadConnected(e) {
    const gamepad = navigator.getGamepads()[e.gamepad.index];

    // Start up new GamepadInterface instance.
    gamepadInterface = new GamepadInterface(gamepad, sampleConfig);

    window.removeEventListener("gamepadconnected", onGamepadConnected);
    window.addEventListener("gamepaddisconnected", onGamepadDisconnected);
  }

  function onGamepadDisconnected (e) {
    // Tear down existing GamepadInterface instance.
    gamepadInterface.disconnect(e);

    window.removeEventListener("gamepaddisconnected", onGamepadDisconnected);
    window.addEventListener("gamepadconnected", onGamepadConnected);
  }

  window.addEventListener("gamepadconnected", onGamepadConnected);
})();


class GamepadInterface extends EventTarget {
  #doDebug = false;
  #stop = false;

  #oldGpState;
  #gpIndex;
  #cfg;

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
    PRESSED: '.Pressed',
    HOLD: '.Hold',
    HOLD_RELEASE: '.HoldRelease'
  };

  // TODO, consider not requiring a gamepad on instance creation,
  // instead, the GamepadInterface might set up its 
  // 'ongamepadconnected' listeners/handlers on its own?

  constructor(gamepad, config) {
    super();
    this.#oldGpState = gamepad;
    this.#gpIndex = gamepad.index;
    this.#cfg = config || {};

    if (this.#cfg.holdMs) this.#holdMs = this.#cfg.holdMs;
    if (this.#cfg.stickDeadzone) this.#stickDeadzone = this.#cfg.stickDeadzone;
    if (this.#cfg.doDebug !== undefined) this.#doDebug = this.#cfg.doDebug;

    this.#init();
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

    // Start the monitoring loop
    requestAnimationFrame(this.#handleUpdate.bind(this));
  }

  // For setting a new configuration.
  // e.g. Switching from gameplay to a UI menu.
  setConfig(config) {
    this.#cfg = config;
  }

  #setOldGamepadState(gp) {
    this.#oldGpState = gp;
  }

  // Gets a fresh state from the current gamepad.
  getGamepad() {
    const currGamepad = navigator.getGamepads ? navigator.getGamepads()[this.#gpIndex] : 
      (navigator.webkitGetGamepads ? navigator.webkitGetGamepads()[[this.#gpIndex]] : []);
    
    if (!currGamepad) throw new Error("No gamepad!");

    return currGamepad;
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
    requestAnimationFrame(this.#handleUpdate.bind(this))
  }

  #checkButtons(gp) {
    this.#buttonsArr.forEach((btnName) => {
      const isPressed = this.isPressed(btnName, gp);
      const wasPressed = this.#wasPressed(btnName);
      const wentDownTimeStamp = this.#timeStamps[btnName + this.#btnEvts.DOWN];

      let timeSinceDown = (wentDownTimeStamp) ? performance.now() - wentDownTimeStamp : null;
      
      if (isPressed && !wasPressed) {
        // Button just went Down
        this.dispatchEvent(new GamepadEvent(btnName + this.#btnEvts.DOWN));

      } else if (!isPressed && wasPressed) {
        // Button just went Up
        this.dispatchEvent(new GamepadEvent(btnName + this.#btnEvts.UP));

        // Check if this is a quick "Pressed" event
        if (timeSinceDown && timeSinceDown < this.#holdMs) {
          this.dispatchEvent(new GamepadEvent(btnName + this.#btnEvts.PRESSED));
        }

        // Button also just went Up from Hold
        if (this.#timeStamps[btnName + this.#btnEvts.HOLD]) {
          this.dispatchEvent(new GamepadEvent(btnName + this.#btnEvts.HOLD_RELEASE));
        }

      } else if (isPressed && wasPressed) {        
        // Test timeSinceDown to determine if a button is in 'Hold' state
        if (timeSinceDown && timeSinceDown > this.#holdMs) {
          this.dispatchEvent(new GamepadEvent(btnName + this.#btnEvts.HOLD));
        }
      }
    });
  }

  // Example events: 'a.Down', 'lt.Up', 'rt.Hold' etc
  #handleBtnEvent(e) {
    // #timeStamps keys are full event names, e.g. 'a.Down', 'y.Hold', 'x.Up'
    const now = e.timeStamp;

    const btnName = this.#getBtnNameFromBtnEvent(e);
    const eventType = this.#getEvtTypeFromBtnEvent(e);

    // Temp shortcut for enum values
    const be = this.#btnEvts;


    if (this.#doDebug && eventType !== be.HOLD) 
      console.log('handleBtnEvent ::', e.type, e.timeStamp);

    // If config passed a handler function for this ButtonEvent, call it.
    const handlerFunc = this.#getHandlerFromConfig(e.type);
    if (handlerFunc) handlerFunc(); 

    // Internal tracking.
    switch (eventType) {
      case be.DOWN :
        this.#timeStamps[btnName + be.DOWN] = now;
        // Clear out the btnName+".Up" value for the given button.
        this.#timeStamps[btnName + be.UP] = null;
        return;

      case be.PRESSED :
        // "Pressed" state is over, clear out related timestamps.
        this.#timeStamps[btnName + be.DOWN] = null;
        this.#timeStamps[btnName + be.UP] = null;
        return;

      case be.HOLD :
        // Do once on initial Hold event.
        if (this.#timeStamps[btnName + be.HOLD] != this.#timeStamps[btnName + be.DOWN]) {
          if (this.#doDebug) console.log('handleBtnEvent ::', e.type, e.timeStamp);
          this.#timeStamps[btnName + be.HOLD] = this.#timeStamps[btnName + be.DOWN];
        }
        return;

      case be.UP :
        this.#timeStamps[btnName + be.UP] = now;
        return;

      case be.HOLD_RELEASE :
        this.#timeStamps[btnName + be.HOLD_RELEASE] = now;
        // TODO Call a HoldRelease handler function with a timeHeld argument?
        this.#timeStamps[btnName + be.HOLD] = null;
        return;

      default:
        return;
      }
  }

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
    const handler = this.#getHandlerFromConfig(handlerName);
    if (handler) handler(vec2);
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

  #getHandlerFromConfig(eventName) {
    return this.#cfg[eventName];
  }

  #getBtnNameFromBtnEvent(e) {
    return e.type.substring(0, e.type.indexOf('.')); // return ex: 'a', 'lt', 'r3'
  }
  #getEvtTypeFromBtnEvent(e) {
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
    if (this.#doDebug) console.log("gamepad disconnected");
  }
}


