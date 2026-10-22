====================================================================
PARÁBOLA BRAVA · README (version 10)
====================================================================

A web game (in the style of Angry Birds) to practice projectile motion
and displacement vectors. This guide explains how the project is
organized and how to change it, even if you only know basic HTML, CSS
and JavaScript.

CONTENTS
  1. How to open the game
  2. The three parts of a web page
  3. Map of folders and files
  4. How the game works, step by step
  5. JavaScript ideas you will see
  6. Recipes to customize the game
  7. The physics of the game
  8. How the online mode works
  9. Saved data and older versions
 10. If something breaks
 11. Publishing on GitHub Pages (and publishing a new version)


--------------------------------------------------------------------
1. HOW TO OPEN THE GAME
--------------------------------------------------------------------
- Quick option: double click index.html. Almost everything works.
- Recommended option (so everything works, including Online mode):
  open the folder with a small local server, for example with the
  "Live Server" extension of VS Code, or in a terminal:
      python -m http.server 8000
  and then open  http://localhost:8000/
- Every time you save a change in a file, reload the page (F5). If the
  browser keeps showing the old version, press Ctrl+F5.


--------------------------------------------------------------------
2. THE THREE PARTS OF A WEB PAGE
--------------------------------------------------------------------
- index.html  → the STRUCTURE: which buttons, panels and boxes exist.
- css/        → the LOOK: colors, sizes, fonts, positions.
- js/         → the BEHAVIOR: physics, menus, editor, online mode.

The JavaScript finds the elements of the HTML by their id. For example
in index.html there is  <b id="scoreValue">0</b>  and in JavaScript
getElement('scoreValue')  gives that element, so the score can be written
in it. Texts with  data-text="Hola|Hello"  are written by JavaScript in
the chosen language (that is why many elements look empty in index.html).


--------------------------------------------------------------------
3. MAP OF FOLDERS AND FILES
--------------------------------------------------------------------
index.html            Structure of every screen. Loads the CSS and JS files.
version.json          Number of the published version (see section 11).
README.txt            This guide.

css/
  base.css            Color and font variables, page basics, and the
                      notebook-style equations.
  menus.css           Home screen, level select, settings, "How to play".
  game.css            Game screen: top bar, scene, controls, panels.
  editor.css          Level editor.
  online.css          Online screens, duels, notices, countdown.

js/  (loaded IN THIS ORDER, see the end of index.html)
  1-core/             Things everything else uses
    utilities.js        Helpers (numbers, formats), colors, APP_VERSION.
    equations.js        Builds math written like in a notebook.
    language.js         Settings (language, animation, sound) and translate().
    sound.js            Sound effects made with the Web Audio API.
    launch-variables.js v₀, θ, h₀ and gravity: limits and default values.
    vectors.js          Vector data, calculations, "can it be solved?".
    levels.js           THE CAMPAIGN LEVELS, cleanLevel(), share codes and
                        the conversion of levels of older versions.
    saved-data-and-state.js  Progress, custom levels, gameState, editorState.
  2-game/             Playing a level
    level-and-hud.js    loadLevel(), sliders of the level, HUD and top bar.
    vector-puzzle.js    The vector phase: walking piglet, answers, solution.
    controls.js         Sliders, keyboard, "Launch equations" panel.
    physics.js          The launch, collisions, breaking, falling pieces.
    level-end.js        End of a shot / level, stars, scoring, telemetry.
  3-editor/           The level editor
    editor-basics.js    Open/close, tabs, undo/redo, tools, Level panel,
                        Launch variables table.
    editor-templates.js Templates (vector, launch and mixed).
    editor-variables-panel.js  "Problem variables" panel, Fix button,
                        advanced table and visibility matrix.
    editor-card-and-pieces.js  Floating property card, placing pieces.
    editor-scene-and-saving.js Mouse/touch in the scene, test, save,
                        open, share codes.
  4-drawing/          Drawing on the canvas
    labels.js           Labels that never overlap (and the "i" marks).
    draw-game.js        The scene while playing (and all drawing helpers).
    draw-editor.js      The scene of the editor (with drag handles).
  5-online/           Online mode
    network.js          Connections (MQTT, PeerJS, claude.ai rooms, local
                        tabs) and the online state objects.
    match-levels.js     The levels of an online game (same or different).
    host-and-player.js  Class game: host and players.
    duel.js             1 vs 1 duels: Race and Hide & seek.
    online-screens.js   Every online screen, player details, CSV, Online menu.
  6-menus/
    menus.js            showView(), level select, settings, version/update.
    how-to-play.js      The "How to play" guide.
    menu-background.js  The animated blueprint behind the menus.
  7-start.js          The main loop (60 times per second) and the start.

Every file starts with a comment that explains what it does, and every
important variable and function has a comment above it.


--------------------------------------------------------------------
4. HOW THE GAME WORKS, STEP BY STEP
--------------------------------------------------------------------
1. index.html loads the CSS and then every JS file in order.
2. 7-start.js translates the page, shows the home screen and starts the
   main loop (drawFrame).
3. Clicking a level calls loadLevel(level) (2-game/level-and-hud.js):
   it copies the pieces, prepares the vector puzzle if there is one and
   sets the sliders.
4. Every frame, drawFrame():
     - moves the projectile (updateProjectile, physics.js)
     - makes pieces fall (updateFallingPieces) and moves particles
     - draws everything again (drawPlayScene in draw-game.js, or
       drawEditorScene in draw-editor.js)
5. When the projectile stops, finishShot() (level-end.js) decides: won,
   lost, or keep aiming.

The main "state" objects (they keep how everything is right now):
  gameState    the level being played (saved-data-and-state.js)
  editorState  the level being edited (saved-data-and-state.js)
  progress     stars and unlocked levels (saved in the browser)
  online, hostState, myPlayer, duelState   the online mode (5-online/)


--------------------------------------------------------------------
5. JAVASCRIPT IDEAS YOU WILL SEE
--------------------------------------------------------------------
The code uses on purpose only simple tools: variables, if/else, for
loops and normal functions. A few things that may be new:

FUNCTIONS
  function add(a, b) { return a + b; }
  An "anonymous function" has no name and is given to someone else to run
  later, for example when a button is clicked:
    button.addEventListener('click', function () { ... });

TEXTS WITH VARIABLES (template literals) — written between back quotes ` `
  `Score: ${points}`  puts the value of points inside the text. Most of the
  HTML that JavaScript creates is written like this.

OBJECTS AND LISTS
  const piece = { kind: 'wood', x: 30 };   piece.kind  →  'wood'
  const list = [3, 5, 8];   list[0] → 3,  list.length → 3,  list.push(13)
  for (const item of list) { ... }   goes through every element of a list.
  for (const key in object) { ... }  goes through every field of an object.

USEFUL TEXT AND LIST FUNCTIONS
  text.slice(0, 40)       the first 40 characters
  text.split('|')         cuts a text into a list
  list.indexOf(x)         position of x in the list (-1 if it is not there)
  list.slice()            a copy of the list
  list.sort(function (a, b) { return a - b; })   orders a list (smallest first)
  JSON.stringify(object)  object → text;   JSON.parse(text)  text → object

THINGS THAT TAKE TIME (asynchronous)
  setTimeout(function () { ... }, 3000)  runs the function after 3 seconds.
  async function / await: "wait here until this finishes" (used to connect
  to the internet, to download, etc.) without freezing the page.

THE BROWSER
  getElement(id)          finds an element of the page (document.getElementById)
  element.hidden = true   hides an element
  element.textContent     the text of an element
  element.innerHTML       the HTML inside an element
  localStorage            a small storage of the browser that survives
                          closing the page (progress, custom levels, settings)

THE CANVAS (drawing)
  gameContext is the "pen" of the canvas:
    fillRect, beginPath, moveTo, lineTo, arc, stroke, fill, fillText
  The world is measured in meters; toScreenX() and toScreenY() convert
  meters into pixels (draw-game.js).


--------------------------------------------------------------------
6. RECIPES TO CUSTOMIZE THE GAME
--------------------------------------------------------------------
CHANGE THE COLORS
  css/base.css, at the top: the variables  --color-...  Every color of
  the page and of the canvas comes from there.

CHANGE THE FONTS
  css/base.css: --font-title, --font-body, --font-numbers,
  --font-handwriting (and the Google Fonts link in index.html).

CHANGE A TEXT
  Search the Spanish (or English) sentence in the files. In JavaScript it
  looks like  translate('Hola', 'Hello');  in index.html like
  data-text="Hola|Hello". Change both languages.

CHANGE THE SCORING
  physics.js: knockDownTarget (+500), breakBlock (50 / 100).
  level-end.js: winLevel (1000 per unused shot, stars).
  vector-puzzle.js: BONUS_POINTS_BY_ATTEMPT.

MAKE A NEW LEVEL (easy)
  Use the level editor and press "Save to my levels". With "Generate and
  copy code" you can send it to anyone.

MAKE A NEW LEVEL INSIDE THE CODE (it comes with the game)
  js/1-core/levels.js: copy a level of LAUNCH_CAMPAIGN, DISPLACEMENT_CAMPAIGN
  or MIXED_CAMPAIGN, give it a new id (for example 'c6') and change its
  values. The explanation of every field is at the top of the file.
  Tip: make the level in the editor, export its code and look at it with
  decodeLevelCode('PB2....') in the browser console.

ADD A PLANET (gravity)
  launch-variables.js: add a line to GRAVITY_OPTIONS.

CHANGE THE SPEED NEEDED TO BREAK STONE
  physics.js: STONE_BREAK_SPEED (18 m/s).

EQUATIONS (notebook style)
  equations.js builds them (mathFraction, mathSquareRoot, mathEquation...);
  how they look is in css/base.css.

LABELS OF THE VECTORS
  labels.js: priorities, candidate positions, the "i" mark.

CHANGE A SOUND
  sound.js: each effect is a small function with numbers (frequency,
  duration, volume). To start with the sound off, change
  soundEffects: true  to  false  in language.js.

CHANGE THE "HOW TO PLAY" GUIDE
  how-to-play.js: getHowToPlaySteps().

CHANGE THE ANIMATED BACKGROUND
  menu-background.js: drawMenuBackground().

CHANGE THE DEFAULT ONLINE RULES
  network.js: DEFAULT_RULES.  Duels: duel.js, DUEL_DEFAULT_RULES.

ADJUST HIDE & SEEK
  duel.js: HIDE_AND_SEEK (map size, waits, shots per reload).

USE YOUR OWN MQTT SERVER
  network.js: add it at the beginning of MQTT_SERVERS.

ADD A TEMPLATE TO THE EDITOR
  editor-templates.js: add it to a list (VECTOR_TEMPLATES, LAUNCH_TEMPLATES
  or MIXED_TEMPLATES) and write what it does in applyVectorTemplate or
  applyLaunchTemplate.


--------------------------------------------------------------------
7. THE PHYSICS OF THE GAME
--------------------------------------------------------------------
PROJECTILE MOTION (no air resistance) — physics.js and controls.js
  vₓ  = v₀ · cos θ              (horizontal speed, constant)
  vᵧ₀ = v₀ · sin θ              (initial vertical speed)
  x(t) = vₓ · t
  y(t) = h₀ + vᵧ₀ · t − ½ · g · t²
  Maximum height: h₀ + vᵧ₀² / (2g)
  The projectile moves with the EXACT formula (not an approximation) and
  collisions are checked 12 times per frame, so it never goes through
  thin blocks.

VECTORS — vectors.js
  Distance:              |V| = d
  Speed and time:        |V| = v · t
  Acceleration and time: |V| = v₀ · t + ½ · a · t²
  Components: Δx = ±|V| · cos θ ,  Δy = ±|V| · sin θ  (the sign depends on
              the direction)
  Resultant:  Rₓ = sum of the Δx ,  Rᵧ = sum of the Δy ,  |R| = √(Rₓ² + Rᵧ²)
  analyzePuzzle() decides if a puzzle can be solved: it starts from the
  given data and applies these formulas until nothing new can be found.


--------------------------------------------------------------------
8. HOW THE ONLINE MODE WORKS
--------------------------------------------------------------------
THREE WAYS TO PLAY (Online button of the home screen)
  - Join a game: type your name and the 5-character code.
  - Class game: the host picks levels and rules, does not play, sees the
    progress of everyone (answers, shots, times) and can download a CSV.
  - 1 vs 1 duel: two players compete (the creator plays too):
      * Race: the same level for both; whoever completes it first wins
        the round. If you fail, the level restarts at once.
        Rounds: 1, best of 3 or best of 5.
      * Hide & seek: each one hides a piglet on the map. The game creates
        clue vectors from the launcher (0, 0):
          difficulty 1 → one vector (length and angle)
          difficulty 2 → 2 or 3 chained vectors
        The piglet walks the vectors ("Replay the path") and disappears in
        a puff. Find the coordinates (x, y) of the rival's piglet (a wrong
        answer means waiting 5 s), then knock it down: 3 shots; after 3
        misses, wait 5 s and reload. Whoever knocks it down first wins.
      During the duel a bar shows what the rival is doing.

HOW THE DEVICES CONNECT
- There is no server of our own: the browser of the HOST keeps the rules
  and decides who wins.
- Outside claude.ai (for example on GitHub Pages) the game tries, in order:
    1. MQTT (broker.emqx.io)     ← free public servers, the same ones used
    2. MQTT (broker.hivemq.com)    with ESP32 boards; it works between
                                   different networks.
    3. PeerJS (direct browser-to-browser connection) as a backup.
- With MQTT each participant publishes their whole state in their own topic:
    parabolabrava/v2/CODE/h        (host)
    parabolabrava/v2/CODE/p/ID     (each player)
  (Version 10 renamed the fields of the messages, so it uses "v2". Every
  player must use version 10 or newer: older versions will not find the game.)
- PRIVACY: public MQTT servers can be read by anyone who knows the topic.
  The game only sends names, points and answers, but do not type personal
  data in the name. For a class you can use your own MQTT server.
- "Different values for each player" uses a random generator with a seed
  (createSeededRandom in network.js): every player always gets the same
  values, even after reloading, and the puzzle is always checked to be
  solvable.
- To test without internet on one computer: open the game in two tabs with
  ?net=local at the end of the address (http://localhost:8000/?net=local).
- Other options of the address (for tests):
    ?net=mqtt      only MQTT          ?net=peer   only PeerJS
    ?mqtt=wss://my-server:8084/mqtt   use another MQTT server


--------------------------------------------------------------------
9. SAVED DATA AND OLDER VERSIONS
--------------------------------------------------------------------
The browser keeps (localStorage):
  parabola-brava            progress (stars, unlocked levels)
  parabola-brava-custom     the levels made in the editor
  parabola-brava-settings   language, background animation, sound
  parabola-brava-name       the name used online
Version 10 renamed the fields of all this data (for example "W" is now
"worldWidth" and "objs" is now "pieces"). Data saved by older versions is
converted automatically when the game opens (see convertOldLevelFormat
in levels.js and loadSavedProgress in saved-data-and-state.js), and old
share codes (they start with "PB1.") still work. New codes start with "PB2.".


--------------------------------------------------------------------
10. IF SOMETHING BREAKS
--------------------------------------------------------------------
- Open the console of the browser: F12 → "Console" tab. Errors appear in
  red with the file and the line.
- You can read any variable there: type  gameState  or  progress  and press
  Enter. Online:  online, hostState, hostPlayers, myPlayer, lastHostState.
- Typical mistakes when editing:
    * A missing comma between elements of a list or object: { a: 1  b: 2 }
    * Brackets that are not closed: ( ) { } [ ]
    * Mixed quotes: 'text"
    * "X is not defined": a name is misspelled, or it is used by a file that
      is loaded BEFORE the file that defines it (check the order in
      index.html). Inside a function it is fine, because functions run later.
- If the game behaves strangely because of old saved data:
  Settings → Reset progress, or in the console:  localStorage.clear()  and
  reload.


--------------------------------------------------------------------
11. PUBLISHING ON GITHUB PAGES
--------------------------------------------------------------------
1. Upload THE WHOLE folder (index.html, version.json, css/, js/ and this
   file) to the root of a GitHub repository, keeping the folders.
2. Settings → Pages → "Deploy from a branch" → branch main → folder / (root).
3. In one or two minutes it will be at
   https://YOUR-USER.github.io/REPOSITORY-NAME/

PUBLISHING A NEW VERSION (so everyone receives the changes)
Browsers keep copies of the files (the "cache"). To make sure everyone
downloads the new files, change the version number in THREE places:
  a) js/1-core/utilities.js:  const APP_VERSION = 10;   → 11
  b) version.json:            { "version": 10 }         → 11
  c) index.html: every  ?v=10  at the end of the css and js addresses → ?v=11
     (with VS Code: Ctrl+H, search  ?v=10  and replace with  ?v=11)
Then players see "a new one is out: v11" in Settings, and the button
"Update to v11" downloads everything again.
