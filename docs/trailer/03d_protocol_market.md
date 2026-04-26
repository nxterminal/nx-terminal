# 03d · NX Market (prediction market)

**Componente elegido: `NXMarket`** (no `ProtocolMarket`). NXMarket trae tabs, cards, OFFICIAL/USER badges, YES/NO con LMSR, modales de buy/exit/create — encaja con el brief (badge, %, Buy buttons). ProtocolMarket es solo una tabla + chart de protocolos creados por devs. Fuente: `frontend/src/windows/NXMarket.jsx` (169 líneas) + `frontend/src/windows/nxmarket/{MarketsList, BuyModal, CreateMarketModal, MarketDetailModal, MyPositions, Leaderboard, Info, PendingMarketsAlert}.jsx`. Markets vienen de `api.listMarkets()` → tabla `nxmarket_markets` (backend). **NO hay markets hardcoded** en producción (solo fixtures de tests).

## Layout general (NXMarket.jsx)

- Wrapper VT323, fondo `--win-bg`. Top: **tab strip** con 4 botones `.win-btn` (active = bold + `border-bottom 2px #000080` + bg blanco):
  - `Markets` · `My Positions` · `Leaderboard` · `Info`
- Body: padding 12px, render del tab activo.
- Footer: `Wallet: 0x12ab…ef34` (o `No wallet connected`) + link azul subrayado `What is NX Market?` que abre `HelpModal`.
- Modales globales: `MarketDetailModal` (al click en card) y `HelpModal`.

## Tab `Markets` — `MarketsList.jsx`

### Filter bar (`.win-panel`, Tahoma 11px)
- Selects: **Status** (Active / Resolved / Closed / All) · **Category** (All / crypto / sports / politics / entertainment / other) · **Type** (All / Official / User).
- Spacer flex.
- Botones derecha: `[+ Create Market (1000 $NXT)]` (disabled si `cap.active_markets >= cap.max_markets`, tooltip "Cap reached: N/M active. Mint more devs..."). Si no wallet: `[Connect Wallet]`. Admin extra: `[Create Official]` (bg amarillo `#fff8c4`).
- Banner admin opcional `PendingMarketsAlert` (markets pendientes de resolver).

### Grid de cards
`grid-template-columns: repeat(auto-fit, minmax(360px, 1fr))`, gap 12px → **2 cols** en ventana default 920px, fallback 1 col bajo 720px.
- **Loading**: texto centrado "Loading markets..."
- **Empty**: `?` enorme (40px gris), "No markets yet" / "Be the first to create one." + botón `[+ Create Market (1000 $NXT)]` (disabled si no wallet).

## Anatomía de una `MarketCard` (`.win-panel`, bg `#fff`, hover `#f5f5ec`, min-height 200px, Tahoma)

### Header (grid 3 cols: ícono | texto | badge)
- **Ícono** 36×36 box `bg #f0f0e8 / border #999`, contiene `<Win98Icon id="cat-{category}">` (24px). Categoría inválida → `cat-other`.
- **Texto**: pregunta (Tahoma 14px bold `#222`) + meta sub (11px `#777`): `<category> · closes in 2d` / `resolved 4h ago` / `closed 3h ago`.
- **TypeBadge** (10px Tahoma bold uppercase, fg blanco): `OFFICIAL` → `#1565c0` azul · `USER` → `#2e7d32` verde.

### Banners de estado
- Resolved YES/NO: `✓ RESOLVED: YES WON` verde (`#e8f8ee` bg, `#1e8449` fg) / `✓ RESOLVED: NO WON` rojo (`#fdecea` bg, `#a93226` fg).
- Resolved invalid: `MARKET INVALIDATED` gris `#eeeeee`.
- Closed pending: `⌛ PENDING RESOLUTION` amarillo `#fff8c4` / fg `#7a5e00`. Probability row queda con opacity 0.6.

### Probability row (2 cols, oculto si resolved)
- **YES** color base `#2ecc71` / dark `#1e8449`. **NO** base `#e74c3c` / dark `#a93226`.
- Layout: label izq (13px bold dark) + porcentaje derecha (20px bold dark) + barra debajo (height 10px, bg `#ddd`, border-inset, fill `linear-gradient(180deg, base 0%, dark 100%)`, width = pct).
- Pct = `Math.round((price ?? 0.5) * 100)` — default 50%.

### Quick-buy row (oculto si resolved)
- Sin wallet: un único botón `.win-btn` `[Connect Wallet to Bet]` (collapse de 2 → 1, mantiene altura).
- Con wallet activo: `[Buy YES]` (verde `#2ecc71`, hover dark) y `[Buy NO]` (rojo `#e74c3c`). 13px Tahoma bold blanco. Click → `BuyModal` (con `e.stopPropagation()` para no abrir DetailModal).
- Closed (no resolved): botones grises `#bdbdbd` opacity 0.55, cursor not-allowed, tooltip "Market closed — awaiting resolution".

### Footer
`Vol: <N> $NXT  |  Pool b = <N>` (11px gris `#777`).

## Categorías reales

5 enum hardcoded en `MarketsList.jsx:11-13`: `crypto · sports · politics · entertainment · other`. **No tienen color por categoría** — la diferenciación visual es 100% por ícono (`Win98Icon` ids `cat-*` registrados en `frontend/src/components/Win98Icons.jsx:1085-1089`). El color solo varía por **tipo** (OFFICIAL azul / USER verde) y por **side** (YES verde / NO rojo).

## Copy literal (lo único hardcoded)

### HelpModal (NXMarket.jsx:38-65)
```
NX Market is a prediction market. Bet $NXT on whether future events resolve YES or NO.
Trading. Each market has a YES side and a NO side. Prices auto-balance via LMSR — buying YES pushes the YES price up. You can exit any time before resolution (3% penalty).
Resolution. When the market closes, an admin declares the winning side. Winners split the pool proportional to shares held. Losers get 0.
Creating a market. Costs 1000 $NXT. The creator earns a 5% commission of the pool when the market resolves.
```

### Info tab — copy seleccionado (Info.jsx)
```
Price reflects collective belief (82% YES = market thinks YES is 82% likely)
Buying shares costs more as the price moves in your favor (slippage)
You can exit before resolution but pay a 3% penalty
```
FAQ punchlines:
```
Q: What happens if nobody bets on the winning side?
A: The full pool (after treasury fee) goes to treasury.

Q: Why is my exit value less than what I paid?
A: LMSR pricing means early buyers get a better price. Exit early =
   slippage against you + 3% penalty.
```

### CreateMarketModal placeholder (CreateMarketModal.jsx:175)
```
Will…?
```

### Dev-scale (Info.jsx:51-59) — tabla en sección "Creating a market"
```
0       Cannot create
1       1
2       2
3       3
4       4
5 – 19  5
20+     Unlimited
```

## Tabs restantes

- **My Positions** — lista de posiciones del wallet + acción Exit (3% penalty).
- **Leaderboard** — top 25 por net profit, toggle all-time / 30d.
- **Info** — 7 secciones sobre fondo `#f7f7f2` (qué es, LMSR, creación, fees, FAQ).

## Sample markets para el trailer

**No existen markets canónicos hardcoded** — todo se crea en runtime vía `CreateMarketModal`. Para el trailer hay que producirlos en vivo (el placeholder del form `Will…?` ya da el tono) o cherry-pickear de la base de prod si está poblada.
