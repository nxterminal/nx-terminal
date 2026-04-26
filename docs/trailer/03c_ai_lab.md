# 03c · AI Lab (Absurd AI Laboratory)

`frontend/src/windows/AILab.jsx` (71 líneas, sin CSS-module). Datos vía `api.getAIs()` → `GET /api/ais` (`backend/api/routes/ais.py:9-19`) que lee `absurd_ais` ORDER BY `weighted_votes DESC`. Las AIs se generan procedurally por el engine usando templates **hardcoded** en `backend/engine/templates.py:86-126` — **NO hay LLM**.

## Estructura visual

- **Header** terminal-bg, VT323 `--text-lg`, `var(--terminal-magenta)` (`#ff44ff`), centrado: `>> ABSURD AI LABORATORY <<`
- **Tabla** (`.win-table`): `# | Name | Description | Votes | Creator`
  - Top 3 (i<3): rank en `gold-on-grey` bold.
  - `Name`: bold púrpura `#9900aa`. `Description`: `--text-xs`, max-width 300px.
- **Loading**: `<div class="loading">Loading absurd AIs...</div>`
- **Empty state**: `No AIs created yet. The devs are still warming up...` (color `--border-dark`, centrado)

> Sin vista de detalle, sin prompt input, sin output area. AILab es solo un leaderboard.

## Generador de NOMBRE (`gen_ai_name`, línea 448)

```python
return f"{random.choice(AI_THINGS)}{random.choice(AI_ACTIONS)} AI"
```

### `AI_THINGS` (50 sustantivos)
```
Pizza, Cat, Ex, Weather, Parking, WiFi, Coffee, Meeting, Monday, Email,
Password, Bug, Deploy, Merge Conflict, 404, Blockchain, NFT, Rug Pull,
Gas Fee, Memecoin, Airdrop, Discord, Twitter, Fridge, Sock, Traffic,
Elevator, Uber, Tinder, Netflix, Spotify, Homework, Hangover, Alarm Clock,
Zoom Call, LinkedIn, Toaster, Laundry, Gym, Dentist, WiFi Password,
USB Direction, Printer, Excel, Microwave, Snack, Vending Machine,
Parallel Parking, Tax, Voicemail
```

### `AI_ACTIONS` (19 sufijos)
```
Predictor, Detector, Optimizer, Analyzer, Generator, Eliminator,
Maximizer, Scanner, Tracker, Translator, Finder, Blocker, Simulator,
Calculator, Evaluator, Negotiator, Scheduler, Classifier, Recommender
```

### Cherry-picks de nombres (50×19 = 950 combos posibles)
```
HangoverDetector AI · ExBlocker AI · USB DirectionFinder AI
TaxOptimizer AI · Merge ConflictNegotiator AI · MondayMaximizer AI
Parallel ParkingSimulator AI · ToasterRecommender AI · VoicemailEliminator AI
PizzaPredictor AI · Rug PullScanner AI · DentistAvoider… (sí, este NO existe — el sufijo siempre sale de AI_ACTIONS)
```

## Generador de DESCRIPCIÓN (`gen_ai_description`, línea 454)

```python
template.format(
    thing=random.choice(AI_THINGS).lower(),
    thing2=random.choice(AI_THINGS).lower(),
    action=random.choice(AI_ACTIONS_VERB),
    pct=random.randint(12, 97)
)
```

### `AI_DESCRIPTIONS` — 12 templates LITERALES
```
1.  Predicts your {thing} patterns with {pct}% accuracy using on-chain sentiment data
2.  Scans for potential {thing} situations before you {action}. {pct}% false positive rate
3.  Automatically optimizes your {thing} schedule based on wallet activity analysis
4.  Uses mass spectrometry data to determine the optimal {thing} timing. Probably wrong
5.  Converts {thing} signals into actionable {thing2} insights. Nobody asked for this
6.  AI-powered {thing} avoidance system. Never {action} again. Theoretically
7.  Rates your {thing} decisions on a scale of 1-10. Currently averaging {pct}/10
8.  Detects hidden {thing} patterns in your {thing2} data. {pct}% recall rate
9.  Predicts which {thing} will ruin your day with {pct}% confidence
10. Cross-references your {thing} history with lunar cycles. Surprisingly accurate {pct}% of the time
11. Uses advanced regression to explain why your {thing} always fails. Spoiler: it's you
12. Monitors {thing2} levels and alerts you before {thing} reaches critical mass
```

### `AI_ACTIONS_VERB` (rellenan `{action}`, 12 frases)
```
enter a restaurant, check your phone, open your laptop, start a meeting,
send an email, make a trade, deploy code, leave the house,
check Twitter, open Discord, accept a calendar invite, merge a PR
```

### Descripciones renderizadas (cherry-picks listas para trailer)
```
Predicts your hangover patterns with 87% accuracy using on-chain sentiment data
Scans for potential ex situations before you check your phone. 73% false positive rate
Uses mass spectrometry data to determine the optimal pizza timing. Probably wrong
Converts wifi signals into actionable monday insights. Nobody asked for this
AI-powered tax avoidance system. Never accept a calendar invite again. Theoretically
Rates your tinder decisions on a scale of 1-10. Currently averaging 4/10
Predicts which printer will ruin your day with 91% confidence
Uses advanced regression to explain why your parallel parking always fails. Spoiler: it's you
Monitors caffeine levels and alerts you before deploy reaches critical mass
Cross-references your sock history with lunar cycles. Surprisingly accurate 64% of the time
```

## Notas tonales para el trailer

- Header magenta CRT + tabla Win98 + nombres tipo Black-Mirror-paródico = pitch visual claro.
- Punchlines más fuertes: **"Spoiler: it's you"** (template #11), **"Nobody asked for this"** (#5), **"Probably wrong"** (#4), **"Theoretically"** (#6).
- Loading copy explícito ("Loading absurd AIs...") y empty copy ("The devs are still warming up...") refuerzan que el sistema asume que los devs son los protagonistas.
- Sin vista de creación en el cliente — se pueden cherry-pickear nombres/descripciones reales para el trailer porque la combinatoria los va a producir tarde o temprano.
