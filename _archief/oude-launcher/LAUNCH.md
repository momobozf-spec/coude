# Al je webapps testen

Elke app heeft een **vaste, eigen poort**, zodat je er zoveel tegelijk kunt
draaien als je wilt zonder botsingen.

## Alles in één keer ⭐

**Dubbelklik `start-all.bat`.**

Dat opent per app een eigen venster en start ze allemaal tegelijk:

| App | URL |
|---|---|
| statische sites | http://localhost:3010 |
| eid-luxe-shop | http://localhost:3001 |
| noor-tracker | http://localhost:3004 |
| printable-generator | http://localhost:3005 |
| webshop | http://localhost:3006 |
| marktonderzoek | http://localhost:3008 |

Geef Next.js ~15 seconden om te compileren. Sluit een venster om die app te
stoppen. (jamal-jamila, luxe-store, superette en noor-app start je apart — zie
onderaan.)

## Lijst tonen

```bash
node launch.mjs
```

Toont elke app, zijn poort, en of hij nu draait (● groen) of stilstaat (○).

## Eén app starten

```bash
node launch.mjs <naam>
```

Start die app op zijn poort en opent de browser. `Ctrl+C` stopt hem.
Bijvoorbeeld: `node launch.mjs webshop` → http://localhost:3006

| Naam | Poort | Soort | Let op |
|---|---|---|---|
| `eid-luxe-shop` | 3001 | Next.js | |
| `jamal-jamila` | 3002 | Next.js | heeft database nodig (`cd jamal-jamila && npm run db:push`) |
| `luxe-store` | 3003 | Next.js | heeft database nodig |
| `noor-tracker` | 3004 | Next.js | |
| `printable-generator` | 3005 | Next.js | |
| `webshop` | 3006 | Vite | |
| `resume-roaster` | 3007 | Vite | API apart: `node resume-roaster/server.js` |
| `marktonderzoek` | 3008 | Express | |
| `brandstofprijzen` | 3011 | statisch | |
| `salaat` | 3012 | statisch | |
| `noor-funnel` | 3013 | statisch | |
| `parking-brussel` | 3014 | statisch | |
| `simple-webapp` | 3015 | statisch | |
| `hikmar` | 3016 | statisch | |

## Alle statische sites tegelijk

```bash
node launch.mjs all-static
```

Serveert álle statische HTML-sites onder één server op http://localhost:3010,
met een indexpagina die naar elke site linkt.

## De twee bijzondere gevallen

**superette** (de onbemande winkel) is een monorepo met vier processen. Start ze
in vier terminals:

```bash
cd superette
npm run dev:db     # database
npm run dev:gate   # MQTT + deurcontroller
npm run dev:api    # API op :4000
npm run dev:pwa    # app op :3000   →  http://localhost:3000
```

**noor-app** is een Expo / React Native-app (mobiel). De webversie:

```bash
cd noor-app
npx expo start --web
```

## Eerste keer een app die niet opstart?

Vrijwel alle apps hebben hun `node_modules` al staan. Mist er een, dan:

```bash
cd <map> && npm install
```
