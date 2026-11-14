# Light Lane

An endless neon lane runner in the browser, by Spipu: run as far as you can on a track that never ends, change lane,
jump and slide to dodge the obstacles, the vehicles and the Sentinel's shots, pick up coins and power-ups. Installable
as a PWA, playable offline, with the keyboard, a gamepad or touch swipes. The 10 best scores are kept on the device.

Built on the Spipu3D engine and the PWA core of [3d-engine](https://github.com/spipu/3d-engine), copied as they are.

## Test locally

```bash
python3 -m http.server 8087 --directory website
```

Then open `http://localhost:8087/`.

## Checks

Run from the repository root, in Node, without a browser:

```bash
node bench/run.js                  # every suite
node bench/run.js --suite runner   # one suite
```

- `collision` — whole runs on written rows: each obstacle passed, each death (front, top, stumbles, gap).
- `commands` — the gamepad stick and buttons turned into orders (direction, thresholds, edges).
- `generation` — the provisional track: the same seed gives the same track, rows on the 0.5 m grid, gaps aligned on
  the tiles.
- `models` — the objects built in code.
- `queue` — an order that cannot run waits 0.20 s, the latest replaces the older.
- `runner` — jump, slide, lane change, fall.
- `scores` — the 10 best scores, ranks, ties, surplus, old records (fake database and memory).
- `static` — every file served is declared in `js/libBootstrap.json`, every declared file exists once, each class
  after the class it extends; every translation in the 4 languages.
- `testMode` — the `?test=` options, on the local host only.

## Tree

```
bench/                 Checks run in Node (bench/run.js and its suites)
website/               The application, served as it is
├── assets/lightLane/  Models and textures of the game
├── css/               Shell, menu structure of the PWA core, the game's theme (lightLane.css)
├── icon/              Icon set (built by .source/icon/buildIcons.py)
├── js/engine/         Spipu3D 3D engine (copy of 3d-engine)
├── js/webapp/         PWA core: bootstrap, storage, settings, translations, inputs, menus (copy of 3d-engine)
├── js/lightLane/      The game: menus, settings, scores, controls, run
└── lib/oswald/        Oswald font (SIL Open Font License)
```

## Sources

`.source/` (kept out of git, on the author's machine) holds everything the generated files come from — the runner's
captures and builder, the background picture, the fog frames, the icons' script, the downloaded packs — with the
commands that rebuild them byte for byte (`.source/README.md`).

## Licence

See `LICENSE.md`. Font: Oswald, SIL Open Font License.
