# Solar Lancer

A third-person 3D space-fighter game that runs in the browser. Fly a lancer through a
compressed solar system — sun, eight planets, moons, ring systems and an asteroid belt —
dodging (or shooting) the rocks. Plays on a laptop with the keyboard and on a phone with
on-screen controls.

**Play:** https://havban.github.io/web-space-game/

## Controls

| Action | Keyboard | Touch |
| --- | --- | --- |
| Pitch | `W` / `S` or `↑` / `↓` | Stick |
| Yaw | `A` / `D` or `←` / `→` | Stick |
| Roll | `Q` / `E` | `⟲` / `⟳` |
| Afterburner | `Shift` | `BOOST` |
| Brake | `Ctrl` / `X` | `BRK` |
| Fire cannons | `Space` | `FIRE` |
| Cycle nav target | `T` | `NAV ▸` |
| Camera view | `C` | — |
| Pause | `P` / `Esc` | `❚❚` |
| Throttle | `+` / `-` | — |

## Scoring

- **100** per asteroid destroyed
- **750** for the first close flyby of each planet
- a trickle of points for distance covered

The hull takes damage from asteroid impacts and from flying into the sun's corona —
at zero hull the flight ends.

## Running it

No build step and no runtime dependencies to install: Three.js and its postprocessing
addons are vendored in `vendor/`. Serve the folder over HTTP (ES modules and an import
map need an origin, so opening `index.html` from the filesystem will not work):

```bash
python3 -m http.server 8000
# then open http://localhost:8000
```

## Layout

```
index.html        shell, HUD markup, touch controls, menus
css/style.css     HUD + responsive UI (safe-area aware, portrait/landscape)
js/config.js      flight/combat tuning and the solar-system table
js/world.js       sun, planets, rings, moons, asteroid belt, starfield
js/ship.js        the fighter's geometry and flight model
js/camera.js      third-person chase camera
js/input.js       keyboard + touch stick/buttons
js/fx.js          pooled lasers and explosions
js/audio.js       synthesised engine, cannons, impacts (WebAudio, no assets)
js/textures.js    procedural planet/sun/ring textures drawn on canvas
js/main.js        bootstrap, game loop, collisions, HUD
```

Quality presets (LOW / MED / HIGH) control bloom, pixel ratio, star count and asteroid
density; the game picks one from the device on first load and remembers your choice.
