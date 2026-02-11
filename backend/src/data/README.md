# Backend Data

## Directory Layout

```
data/
├── static/              ← Drop-in JSON arrays, loaded once at server start
│   ├── factions.json
│   ├── units.json
│   ├── weapons.json
│   └── modifications.json
├── loader.ts            ← Typed loader that reads static/ into memory
└── README.md
```

## Static Data (`static/`)

Each file is a **JSON array** whose element type lives in `@ba-hub/shared`:

| File                  | Shared Type     | Purpose                        |
|-----------------------|-----------------|--------------------------------|
| `factions.json`       | `Faction`       | US / RU faction definitions    |
| `units.json`          | `ArsenalUnit`   | Every unit in the arsenal      |
| `weapons.json`        | `Weapon`        | Weapon / armament entries      |
| `modifications.json`  | `Modification`  | Upgrade / modification entries |

## Usage

```ts
import { loadStaticData } from './data/loader.js';

const data = await loadStaticData();
// data.factions, data.units, data.weapons, data.modifications
```

The loader gracefully returns empty arrays for missing files and logs a warning,
so you can add data files incrementally without breaking the server.
