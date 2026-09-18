# Solar Lancer

A third-person 3D space-fighter game that runs in the browser. Fly a lancer through a
compressed solar system — sun, eight planets, moons, ring systems and an asteroid belt —
running contracts for your mothership. Plays on a laptop with the keyboard and on a phone
with on-screen controls.

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

## The campaign

Five levels, twelve missions. Each level parks your mothership near a different planet
and strings together two or three missions, which you fly in order:

| Mission | What it asks of you |
| --- | --- |
| **Transport** | Collect crates at one anchor and run them to another. Cargo is slung under the fuselage and costs you top speed, and some runs get intercepted. |
| **Combat** | Clear a set number of raider fighters. They arrive in waves. |
| **Assault** | Kill an enemy mothership. Its turrets shield the core — while any turret still stands the hull soaks up ~78% of your damage, so knock the guns out first. Turrets only cover their own flank, so come in from the side they can't reach. |

| Level | Home | Missions |
| --- | --- | --- |
| 1 · SHAKEDOWN | Earth | transport, combat |
| 2 · BELT PATROL | Mars | combat, transport |
| 3 · FIRST STRIKE | Jupiter | combat, assault |
| 4 · DEEP WATER | Saturn | transport, combat, assault |
| 5 · THE OUTER DARK | Neptune | combat, transport, assault |

### Your mothership

Every level has a friendly capital ship with a lit docking ring. Fly inside its docking
radius **below 240 u/s** and you dock: the hull repairs, the afterburner tank refills, and
nothing can hurt you until you leave. Brake on approach if you want to sit there a while.
The HUD tells you when you are close but coming in too hot.

The nav readout locks onto `OBJECTIVE` by default, which always points at whatever the
current mission wants next; `T` cycles through the planets, your mothership and theirs.

## Scoring

- **100** per asteroid destroyed
- **300** per enemy fighter (half that if you ram it)
- **400** per turret, **5,000** for an enemy mothership
- **1,500** per mission, **4,000** per level, **600** per crate delivered
- **750** for the first close flyby of each planet
- a trickle of points for distance covered

The hull takes damage from asteroid impacts, enemy fire, collisions and the sun's corona.
At zero hull the flight ends and you can retry the level from the start.

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
js/entities.js    enemy fighters, their bolts, and both motherships
js/missions.js    the campaign: levels, missions, cargo, docking
js/audio.js       synthesised engine, cannons, impacts (WebAudio, no assets)
js/textures.js    procedural planet/sun/ring textures drawn on canvas
js/main.js        bootstrap, game loop, collisions, HUD, campaign flow
```

Quality presets (LOW / MED / HIGH) control bloom, pixel ratio, star count and asteroid
density; the game picks one from the device on first load and remembers your choice.
