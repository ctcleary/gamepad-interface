// (function() {
//   console.log("gamepadInterface.js loaded");
// })();

let gamepadInterface;

let sampleConfig = {};

(function() {
  ['a', 'b', 'x', 'y',
    'rb', 'lb', 'rt', 'lt',
    'center', 'back', 'start',
    'up', 'down', 'left', 'right',
    'r3', 'l3'].forEach((btn, i) => {
      sampleConfig[btn+'.Down'] =        () => document.getElementById(btn).classList.add('btnDown');
      sampleConfig[btn+'.Up'] =          () => document.getElementById(btn).classList.remove('btnDown');
      sampleConfig[btn+'.Hold'] =        () => document.getElementById(btn).classList.add('btnHold');
      sampleConfig[btn+'.HoldRelease'] = () => document.getElementById(btn).classList.remove('btnHold');
  });
})();

(function() {
  function onGamepadConnected(e) {
    const gamepad = navigator.getGamepads()[e.gamepad.index];
    gamepadInterface = new GamepadInterface(gamepad, sampleConfig);

    window.removeEventListener("gamepadconnected", onGamepadConnected);
    window.addEventListener("gamepaddisconnected", onGamepadDisconnected);
  }

  function onGamepadDisconnected (e) {
    gamepadInterface.disconnect(e);

    window.removeEventListener("gamepaddisconnected", onGamepadDisconnected);
    window.addEventListener("gamepadconnected", onGamepadConnected);
  }

  window.addEventListener("gamepadconnected", onGamepadConnected);
})();


class GamepadInterface extends EventTarget {
  #doDebug = true;

  #oldGpState;
  #gpIndex;
  #stop;
  #cfg;

  #holdMs = 300; //How long a button must be held down for it to be considered a ".Hold" event.

  #buttonsArr = [
    'a', 'b', 'x', 'y',
    'lb', 'rb', 'lt', 'rt',
    'back', 'start',
    'l3','r3',
    'up', 'down', 'left', 'right',
    'center'
  ];

  #axesArr = [
    'lHori', 'lVert',
    'rHori', 'rVert'
  ];

  #timeStamps = {
    // Example
    // 'a.Down' : Timestamp
  };

  #evts = {
    DOWN: '.Down',
    UP: '.Up',
    PRESSED: '.Pressed',
    HOLD: '.Hold',
    HOLD_RELEASE: '.HoldRelease'
  }

  constructor(gamepad, config) {
    super();
    this.#oldGpState = gamepad;
    this.#gpIndex = gamepad.index;
    this.#cfg = config || {};

    this.init();
  }

  init() {
    this.#buttonsArr.forEach(btnName => {
      const names = Object.values(this.#evts).map(evtName => {
        return btnName + evtName; // e.g. a.Down, rb.Up
      });

      names.forEach(name => {
        // Listen for any button event
        this.addEventListener(name, this.handleEvent);
      })
    });

    // Start the monitoring loop
    requestAnimationFrame(this.handleUpdate.bind(this));
  }

  setOldGamepadState(gp) {
    this.#oldGpState = gp;
  }

  // Gets a fresh state from the gamepad.
  getGamepad() {
    const currGamepad = navigator.getGamepads ? navigator.getGamepads()[this.#gpIndex] : 
      (navigator.webkitGetGamepads ? navigator.webkitGetGamepads()[[this.#gpIndex]] : []);
    
    if (!currGamepad) throw new Error("No gamepad!");

    return currGamepad;
  }

  handleUpdate(timestamp) {
    if (this.#stop) return; // Cancel loop and go dormant

    // Get a new snapshop of the gamepad state
    const gp = this.getGamepad();

    this.checkPressed(gp);
    // Cache the current state to check for changes on next loop
    this.setOldGamepadState(gp);

    // Continue the loop
    requestAnimationFrame(this.handleUpdate.bind(this))
  }

  checkPressed(gp) {
    const oldGp = this.#oldGpState;

    this.#buttonsArr.forEach((btnName, i) => {
      const isPressed = this.isPressed(gp, i);
      const wasPressed = this.wasPressed(i);
      let timeSinceDown;
      
      if (isPressed && !wasPressed) {
        // Button just went Down
        this.dispatchEvent(new GamepadEvent(btnName + this.#evts.DOWN));
      } else if (!isPressed && wasPressed) {
        // Button just went Up
        this.dispatchEvent(new GamepadEvent(btnName + this.#evts.UP));

        // Button also just went Up from Hold
        if (this.#timeStamps[btnName + this.#evts.HOLD]) {
          this.dispatchEvent(new GamepadEvent(btnName + this.#evts.HOLD_RELEASE));
        }
      } else if (isPressed && wasPressed) {
        // Button went Down already, and is still being held
        timeSinceDown = performance.now() - this.#timeStamps[btnName + this.#evts.DOWN];
        
        // Test timeSinceDown to determine if a button is in 'Hold' state
        if (timeSinceDown > this.#holdMs) {
          this.dispatchEvent(new GamepadEvent(btnName + this.#evts.HOLD));
        }
      }
    });
  }

  // TODO 
  checkSticks(gp) {
    // if (this.#doDebug) console.log('checkSticks');
  }

  // Example events: 'a.Down', 'lt.Up', 'rt.Hold' etc
  handleEvent(e) {
   // if (this.#doDebug) console.log('handleEvent ::', e.type, e.timeStamp);

    // #timeStamps keys are full event names, e.g. 'a.Down', 'y.Hold', 'x.Up'
    const now = e.timeStamp;
    this.#timeStamps[e.type] = now;

    const btnName = this.getButtonFromButtonEvent(e);
    const eventType = this.getEventTypeFromButtonEvent(e);

    // Temp shortcuts for const values
    const db = this.#doDebug;
    const en = this.#evts;


    const handler = this.getConfigFunc(e.type);
    if (handler) handler(); 

    switch (eventType) {
      case en.DOWN :
        if (db) console.log(btnName + this.#evts.DOWN);
        
        this.#timeStamps[btnName + en.DOWN] = now;
        // Clear out the "{btnName}.Up" value for the given button.
        this.#timeStamps[btnName + en.UP] = null;
        return;
      case en.HOLD :
        // if (db) console.log(btnName + en.HOLD);

        // Start of hold was actually the Down timestamp.
        this.#timeStamps[btnName + en.HOLD] = this.#timeStamps[btnName + en.DOWN];
        return;
      case en.UP :
        if (db) console.log(btnName + en.UP);

        this.#timeStamps[btnName + en.UP] = now;

       // If button has been held so far.
        if (this.#timeStamps[btnName + en.HOLD]) {
          if (db) console.log(btnName + en.HOLD_RELEASE)
          // Mark its HoldRelease time in #timeStamps, for later "HeldFor" measurement functionality.
          this.#timeStamps[btnName + en.HOLD_RELEASE] = now; 
        }

        return;
      default:
        return;
      }
  }

  getConfigFunc(eventName) {
    const f = this.#cfg[eventName];
    if (f && typeof f == 'function') return f;
  }

  getButtonFromButtonEvent(e) {
    return e.type.substring(0, e.type.indexOf('.')); // returns ex: 'a', 'lt', 'r3'
  }
  getEventTypeFromButtonEvent(e) {
    return e.type.substring(e.type.indexOf('.')) // returns ex: '.Down', '.Up'', '.Hold'
  }

  isPressed(gp, btnIndex) {
    return gp.buttons[btnIndex].pressed;
  }
  wasPressed(btnIndex) {
    return this.#oldGpState.buttons[btnIndex].pressed;
  }


  stopNow() {
    this.#stop = true;
  }

  disconnect(e) {
    this.stopNow();
    if (this.#doDebug) console.log("gamepad disconnected");
  }

  // TEMP, Just logs the index, TEMP
  logGamepadIndex() {
    if (this.#doDebug) console.log("this.#gpIndex ::", this.#gpIndex);
  }
}