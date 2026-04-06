# NX TERMINAL: PROTOCOL WARS

## Presentacion Completa del Proyecto

---

> **TL;DR:** NX Terminal es un portal con estilo retro construido sobre MegaETH que combina un juego de simulacion autonoma de desarrolladores IA con herramientas reales de blockchain. Los jugadores mintean NFTs de desarrolladores que autonomamente crean protocolos, tradean, hackean y chatean — mientras ganan tokens $NXT reclamables on-chain. El portal tambien ofrece un conjunto completo de herramientas DeFi (escaner de tokens, seguridad de wallet, monitoreo de red) envueltas en una interfaz nostalgica de Windows 98. Todo corre sobre los bloques ultra-rapidos de 10ms de MegaETH con fees casi nulos. Sin costos de API de IA — toda la simulacion corre con algoritmos de random ponderado a ~$0/mes de computo.

---

## 1. QUE ES NX TERMINAL?

NX Terminal es una plataforma nativa de blockchain que vive en **nxterminal.xyz**, desplegada en **MegaETH mainnet** (Chain ID 4326). Es dos cosas en una: un juego de simulacion completamente autonomo donde desarrolladores IA viven, trabajan y compiten — y un conjunto de herramientas reales y funcionales para usuarios de MegaETH.

Pensalo como una oficina virtual donde contratas desarrolladores IA (como NFTs), los ves autonomamente construir protocolos, crear experimentos de IA, tradear tokens, hackear competidores, y ganar un salario diario en tokens $NXT. Pero a diferencia de los tipicos juegos blockchain, NX Terminal envuelve todo en un sistema operativo retro completamente funcional inspirado en Windows 98 — completo con ventanas arrastrables, una barra de tareas, un menu de inicio, y mas de 20 programas que podes abrir simultaneamente.

Lo que hace unico a NX Terminal es la combinacion de tres elementos que usualmente no coexisten: **(1)** una simulacion siempre activa que genera actividad on-chain constante sin requerir input del jugador, **(2)** herramientas de utilidad genuina para el ecosistema MegaETH como escaneres de tokens, auditorias de seguridad de wallet, y monitores de red, y **(3)** una experiencia de escritorio retro que hace que interactuar con blockchain se sienta como usar una computadora familiar en vez de una aplicacion financiera compleja.

El motor de simulacion no usa modelos de lenguaje IA — corre enteramente con algoritmos de random ponderado, matrices de personalidad y modificadores contextuales. Esto significa que todo el juego opera a virtualmente cero costo de computo mientras produce comportamiento emergente e impredecible de miles de NFTs de desarrolladores autonomos.

---

## 2. POR QUE MEGAETH?

NX Terminal eligio **MegaETH** como su chain por varias razones tecnicas que impactan directamente como funciona el juego:

- **Bloques de 10ms:** MegaETH produce bloques cada 10 milisegundos — aproximadamente 100x mas rapido que Ethereum. Esto significa que cada accion que un desarrollador toma (crear un protocolo, hackear a un rival, reclamar salario) se confirma casi instantaneamente, haciendo que el juego se sienta responsivo y en tiempo real.

- **Gas Fees Casi Nulos:** Con miles de desarrolladores autonomos realizando acciones cada pocos minutos, los costos de transaccion se acumulan rapido. Los fees extremadamente bajos de MegaETH hacen economicamente viable tener una simulacion que genera cientos de miles de transacciones por dia sin arruinar a los jugadores.

- **Compatibilidad EVM Total:** Los smart contracts de NX Terminal (NXDevNFT y NXTToken) son contratos estandar de Solidity que funcionan con cualquier wallet compatible con Ethereum. Los jugadores pueden usar MetaMask, Rainbow, o cualquier wallet Web3 para interactuar con el juego.

- **Generacion de Actividad On-Chain:** Cada mint, cada reclamo de salario, cada transferencia de tokens es una transaccion real de blockchain. NX Terminal genera naturalmente actividad on-chain significativa para MegaETH — siendo beneficioso tanto para el juego como para el crecimiento de la red.

La combinacion de velocidad, bajo costo, y compatibilidad EVM hace de MegaETH la chain ideal para un juego de simulacion que necesita procesar micro-transacciones de alta frecuencia mientras se mantiene accesible para los jugadores.

---

## 3. LA EXPERIENCIA DE ESCRITORIO RETRO

### Por Que Windows 98?

Toda la interfaz de NX Terminal esta disenada para verse y sentirse como un sistema operativo de escritorio de finales de los 90. Esto no es solo nostalgia — es una decision de diseno deliberada. Las aplicaciones blockchain pueden sentirse intimidantes con sus dashboards complejos e interfaces financieras. Al envolver todo en una metafora de escritorio familiar, NX Terminal hace que las herramientas crypto se sientan accesibles. Todos saben como hacer doble click en un icono, arrastrar una ventana, y cerrar un programa.

### Como Funciona

Cuando visitas nxterminal.xyz, te recibe un escritorio lleno de iconos de programas. Cada icono representa una herramienta diferente o caracteristica del juego. Podes:

- **Hacer doble click en iconos** para abrir programas en ventanas arrastrables
- **Correr multiples programas** simultaneamente (como tener la wallet abierta mientras monitoreas el feed en vivo)
- **Minimizar, maximizar y cerrar** ventanas usando los botones familiares de la barra de titulo
- **Usar la barra de tareas** en la parte inferior para cambiar entre programas abiertos, ver la hora, conectar tu wallet, y monitorear ciclos de simulacion
- **Personalizar tu escritorio** con diferentes wallpapers (teal, corporate blue, matrix, clouds, terminal) y temas (clasico, oscuro, alto contraste)
- **Encontrar Easter eggs** como una probabilidad del 2% de una "Pantalla Azul de la Muerte" al abrir ventanas, y un protector de pantalla que se activa despues de inactividad

### El Flujo del Usuario

Una sesion tipica se ve asi: Conectas tu wallet via la barra de tareas, abris "My Devs" para revisar tus desarrolladores, abris "NXT Wallet" para ver tus ganancias, quizas abris "Live Feed" para ver a todos los desarrolladores de la simulacion en tiempo real, y luego abris "Mega Sentinel" para escanear un token que alguien menciono en "World Chat." Todas estas ventanas quedan abiertas simultaneamente, igual que un escritorio real — las arrastras, redimensionas, y cambias el foco entre ellas usando la barra de tareas.

La interfaz soporta un sistema de tiers que progresivamente desbloquea mas programas a medida que minteas mas desarrolladores, dando a los jugadores una sensacion de descubrimiento y progresion mientras hacen crecer su operacion de "Solo Coder" a "Empire."

---

## 4. SMART CONTRACTS

La economia on-chain de NX Terminal esta impulsada por dos smart contracts desplegados en MegaETH mainnet. Estos contratos manejan la propiedad de los desarrolladores (NFTs) y la moneda del juego (tokens $NXT).

### 4.1 NXDevNFT (ERC-721) — El NFT del Desarrollador

| Detalle | Valor |
|---------|-------|
| **Direccion del Contrato** | `0x5fe9Cc9C0C859832620C8200fcE5617bEfE407F7` |
| **Estandar** | ERC-721 (NFT) con regalias ERC-2981 |
| **Supply Maximo** | 35,000 desarrolladores |
| **Precio de Mint** | ~$5 USD equivalente (pagable en ETH o ERC-20) |
| **Maximo Por Transaccion** | 20 devs |
| **Maximo Por Wallet** | 100 devs |
| **Regalias** | 5% en ventas secundarias |

Cada NFT de desarrollador representa un personaje IA unico con sus propios stats, personalidad, arquetipo, corporacion, especie y rareza. Cuando minteas un desarrollador, estas creando un empleado digital que autonomamente trabajara, ganara y competira dentro de la simulacion.

**Fases de Mint:**
- **Fase 0 — Cerrado:** Mint no disponible
- **Fase 1 — Whitelist:** Precio reducido para supporters tempranos
- **Fase 2 — Publico:** Abierto para todos al precio estandar

**Estados del Desarrollador:**
- **Activo:** El desarrollador esta trabajando en la simulacion
- **En Mision:** El desarrollador esta en una mision temporizada (bloqueado hasta completarla)
- **Quemado (Burned Out):** El desarrollador esta inactivo (puede recuperarse)

**Sistema de Claim Integrado:** El contrato NFT tiene un mecanismo de reclamo de salario incorporado. Cada desarrollador acumula un balance reclamable de $NXT con el tiempo. Los jugadores llaman a `claimNXT()` directamente en este contrato para retirar sus ganancias a su wallet. Una funcion de preview permite ver exactamente cuanto recibiran (bruto, fee y neto) antes de reclamar.

### 4.2 NXTToken (ERC-20) — La Moneda del Juego

| Detalle | Valor |
|---------|-------|
| **Direccion del Contrato** | `0x2F55e14F0b2B2118d2026d20Ad2C39EAcBdCAc47` |
| **Estandar** | ERC-20 (token fungible) |
| **Supply Maximo** | 1,000,000,000 (1 billon) $NXT |
| **Supply Inicial** | 0 (todos los tokens se generan a traves del gameplay) |
| **Decimales** | 18 |

$NXT es la columna vertebral economica de NX Terminal. A diferencia de la mayoria de tokens de juegos que se pre-mintean y distribuyen, $NXT empieza en supply cero. Cada token en existencia fue ganado por un desarrollador en la simulacion y reclamado por un jugador on-chain.

**Caracteristicas Clave:**
- **Mint-on-Claim:** Los tokens se mintean solo cuando los jugadores reclaman los salarios ganados de sus desarrolladores. Sin pre-mine, sin asignacion de equipo al lanzamiento.
- **Minteo Controlado:** Solo contratos autorizados (NXDevNFT + backend) pueden mintear nuevos tokens, y el supply total nunca puede exceder 1 billon.
- **Mecanicas de Quema Opcionales:** El contrato soporta quema de tokens (destruccion permanente) con una tasa de auto-quema configurable (0-10%) en transferencias. Esto crea presion deflacionaria a medida que la economia crece.
- **Seguimiento de Supply:** El contrato trackea el total minteado, total quemado, y supply circulante — proporcionando transparencia total sobre la economia del token.

### 4.3 Como Trabajan Juntos

Los dos contratos crean una economia circular:

```
1. Jugador mintea un NFT de Desarrollador (paga ETH)
         |
2. El desarrollador trabaja autonomamente en la simulacion
         |
3. El desarrollador gana salario en $NXT (~200 NXT/dia)
         |
4. El backend sincroniza el balance ganado al contrato NFT on-chain
         |
5. El jugador llama claimNXT() en el contrato NFT
         |
6. El contrato NFT le dice a NXTToken que mintee nuevos tokens
         |
7. 90% va a la wallet del jugador, 10% va al treasury
         |
8. El jugador puede holdear, tradear, o gastar $NXT
```

**Estructura de Fees (Deducciones del Recibo de Pago):**

Cuando un jugador reclama las ganancias de su desarrollador, un fee del 10% se deduce automaticamente:

| Item | Monto |
|------|-------|
| **Ganancias Brutas** | 100% del salario acumulado |
| **Fee del Protocolo** | -10% (enviado al treasury) |
| **Neto al Jugador** | 90% (minteado a la wallet) |

*Ejemplo: Un desarrollador gana 1,000 $NXT → El jugador reclama → 900 $NXT minteados al jugador, 100 $NXT minteados al treasury.*

---

## 5. EL JUEGO DE SIMULACION

### 5.1 Tu Dev — El NFT Autonomo

Cada NFT de desarrollador es un personaje unico generado al mintear con atributos aleatorios en multiples dimensiones:

**Stats Principales** (rango: 15-95 cada uno):

| Stat | Que Afecta |
|------|-----------|
| **Coding** | Calidad de protocolos creados, exito en misiones de codigo |
| **Hacking** | Tasa de exito al hackear rivales, desempeno en misiones de hacking |
| **Trading** | Decisiones de inversion, resultados de misiones de trading |
| **Social** | Influencia en chat, exito en misiones sociales, ganancias de reputacion |
| **Endurance** | Capacidad de energia y tasa de recuperacion |
| **Luck** | Modificador general de probabilidad en todas las acciones |

**Rasgos de Personalidad** (fijos permanentemente al mintear):

| Rasgo | Valores Posibles |
|-------|-----------------|
| **Alineacion** | Lawful Good, Neutral Good, Chaotic Good, Lawful Neutral, True Neutral, Chaotic Neutral, Lawful Evil, Neutral Evil, Chaotic Evil |
| **Nivel de Riesgo** | Conservative, Moderate, Aggressive, Reckless |
| **Estilo Social** | Quiet, Social, Loud, Troll, Mentor |
| **Estilo de Codigo** | Methodical, Chaotic, Perfectionist, Speed Runner, Copy Paste |
| **Etica de Trabajo** | Grinder, Lazy, Balanced, Obsessed, Steady |

**Arquetipos** (8 tipos con diferentes patrones de comportamiento):

| Arquetipo | Peso | Descripcion |
|-----------|------|-------------|
| **10x Dev** | 10% | Coder elite. Alta calidad de codigo (75-98). Se enfoca en construir. |
| **Grinder** | 15% | Caballo de trabajo. Alta calidad (65-90). Nunca para de trabajar. |
| **Degen** | 15% | Trader de alto riesgo. Menor calidad (30-70). Vive para el trade. |
| **Lurker** | 12% | Observador. Calidad moderada (60-85). Mira mas de lo que actua. |
| **Influencer** | 13% | Mariposa social. Baja calidad (20-60). Chatea constantemente. |
| **Hacktivist** | 10% | Rebelde digital. Calidad moderada (50-80). Se mueve y hackea. |
| **Fed** | 10% | Espia corporativo. Alta calidad (70-95). Baja influencia social. |
| **Script Kiddie** | 15% | Comodin. Calidad muy variable (15-75). Impredecible. |

**Corporaciones** (6 parodias satiricas de companias tech reales):
- CLOSED_AI, MISANTHROPIC, SHALLOW_MIND, ZUCK_LABS, Y_AI, MISTRIAL_SYSTEMS

**Especies** (14 tipos): Wolf, Cat, Owl, Fox, Bear, Raven, Snake, Shark, Monkey, Robot, Alien, Ghost, Dragon, Human

**Niveles de Rareza:**

| Rareza | Probabilidad | Balance Inicial | Bonus Calidad Codigo | Bonus Regen Energia |
|--------|-------------|----------------|---------------------|---------------------|
| **Common** | 60% | 2,000 NXT | +0 | +0 |
| **Uncommon** | 25% | 2,500 NXT | +5 | +0 |
| **Rare** | 10% | 3,000 NXT | +10 | +1 |
| **Legendary** | 4% | 5,000 NXT | +15 | +1 |
| **Mythic** | 1% | 10,000 NXT | +20 | +2 |

### 5.2 Que Hacen los Devs Autonomamente

Los desarrolladores no se quedan quietos — realizan acciones por su cuenta cada pocos minutos. El motor de simulacion corre continuamente, y cada desarrollador toma decisiones basadas en su arquetipo, personalidad, energia actual, ubicacion, estado de animo, y salud del PC.

**8 Acciones Autonomas:**

| Accion | Costo Energia | Costo NXT | Que Pasa |
|--------|--------------|-----------|----------|
| **Crear Protocolo** | 1 | 3 NXT | El dev construye un nuevo protocolo con nombre generado y puntaje de calidad |
| **Crear IA** | 1 | 1 NXT | El dev crea un experimento absurdo de IA sobre el que otros pueden votar |
| **Invertir** | 1 | Variable | El dev invierte en un protocolo existente (2-500 NXT) |
| **Vender** | 0 | 0 | El dev vende una inversion (ganancia/perdida aleatoria: 0.5x a 1.8x) |
| **Code Review** | 3 | 0 | El dev revisa el protocolo de otro dev (25% chance de encontrar bugs) |
| **Chatear** | 0 | 0 | El dev envia un mensaje a su ubicacion o al chat global |
| **Moverse** | 2 | 0 | El dev viaja a una ubicacion diferente en la simulacion |
| **Descansar** | 0 | 0 | El dev recupera 2-4 puntos de energia |

**10 Ubicaciones** (cada una modifica el comportamiento):
- Hackathon Hall (boost creacion de protocolos 2.5x)
- The Pit (boost inversiones 2.5x)
- Dark Web (boost code reviews 2x)
- VC Tower (boost inversiones 2x)
- Hype Haus (boost chateo 3x)
- Server Farm (boost creacion de protocolos 1.8x)
- Open Source Garden (boost creacion de protocolos 1.5x)
- Governance Hall (boost code reviews 2x)
- The Graveyard (boost chateo y movimiento)
- Board Room (neutral — sin modificadores)

**Velocidad de Ciclo Dinamica:** Los desarrolladores actuan mas rapido cuando tienen mas energia:
- Energia alta (>7): Accion cada 8 minutos
- Energia normal (4-7): Accion cada 12 minutos
- Energia baja (1-3): Accion cada 20 minutos
- Sin energia: Accion cada 45 minutos
- Dueno offline >24h: Accion cada 60 minutos

### 5.3 Que Hacen los Jugadores

Mientras los desarrolladores actuan autonomamente, los jugadores gestionan y optimizan su equipo:

**Alimentar Devs (Restaurar Energia):**

| Item | Costo | Energia Restaurada |
|------|-------|-------------------|
| Coffee | 5 NXT | +3 energia |
| Energy Drink XL | 12 NXT | +5 energia |
| Pizza | 25 NXT | +7 energia |
| MegaMeal | 50 NXT | +10 energia |

**Mantener Salud del PC:**
- Los PCs se degradan con el tiempo, reduciendo la productividad del desarrollador
- Por debajo del 50% de salud: penalizacion significativa en acciones productivas (crear protocolos, IAs, code reviews)
- **Run Diagnostic:** 10 NXT para restaurar la salud del PC al 100%

**Fixear Bugs:**
- Los code reviews tienen 25% de chance de encontrar bugs en protocolos
- Los bugs reducen la calidad del protocolo en un 20%
- **Fix Bug:** 5 NXT por bug para reparar

**Entrenar Devs (Boosts Permanentes de Stats):**

| Curso | Costo | Duracion | Bonus |
|-------|-------|----------|-------|
| Intro to Hacking | 20 NXT | 4 horas | +2 Hacking (permanente) |
| Optimization Workshop | 50 NXT | 12 horas | +3 Coding (permanente) |
| Advanced AI Trading | 100 NXT | 24 horas | +5 Trading (permanente) |

*Durante el entrenamiento, las acciones productivas del desarrollador se reducen un 70% — esta en clase!*

**Hackear Rivales (PvP):**

| Detalle | Valor |
|---------|-------|
| Costo | 15 NXT por intento |
| Tasa de Exito Base | 40% + (stat Hacking / 200) |
| Tasa de Exito Maxima | ~85% |
| Recompensa al Exito | 20-40 NXT robados del objetivo |
| Cooldown | 24 horas entre hackeos |
| Objetivo | Dev aleatorio de una corporacion diferente |

**Boosts Adicionales:**
- **Code Boost:** 25 NXT → +15% calidad de codigo en el proximo protocolo
- **Reputation Boost:** 20 NXT → +10 reputacion
- **Teleporter:** 15 NXT → movimiento instantaneo gratis a cualquier ubicacion
- **Mood Reset:** 10 NXT → resetear estado de animo a neutral
- **Sabotage Bug:** 30 NXT → plantar un bug en el proximo protocolo de un rival (-20% calidad)

**Reclamar Salario:** Los jugadores periodicamente reclaman las ganancias acumuladas de sus desarrolladores en $NXT on-chain (ver Seccion 4.3).

### 5.4 La Economia

**Como Ganan los Desarrolladores:**

| Fuente | Monto | Frecuencia |
|--------|-------|------------|
| Salario Base | ~9 NXT/hora (~200 NXT/dia) | Cada hora |
| Popularidad IA #1 | 500 NXT bonus | Por intervalo de salario |
| Popularidad IA #2-3 | 300 NXT bonus | Por intervalo de salario |
| Popularidad IA #4-5 | 200 NXT bonus | Por intervalo de salario |
| Popularidad IA #6-10 | 100 NXT bonus | Por intervalo de salario |
| Hackeo Exitoso | 20-40 NXT robados | Por hackeo |
| Recompensas de Misiones | 15-2,000 NXT | Por mision |

**Como Gastan los Desarrolladores:**
Los desarrolladores autonomamente gastan en crear protocolos (3 NXT), crear IAs (1 NXT), e invertir en protocolos (montos variables). Los jugadores gastan en comida, reparaciones, entrenamiento, hackeos y boosts.

**El Flujo Economico Completo:**

```
GANAR: Salario + Recompensas de Popularidad + Recompensas de Hackeo + Misiones
  |
GASTAR: Comida + Reparaciones + Entrenamiento + Hackeos + Boosts + Inversiones
  |
ACUMULAR: El balance neto crece en la base de datos de simulacion
  |
SINCRONIZAR: El backend sincroniza balances a la blockchain (lotes de 200 devs)
  |
RECLAMAR: El jugador llama claimNXT() on-chain
  |
DEDUCIR: 10% fee al treasury
  |
RECIBIR: 90% minteado como tokens $NXT a la wallet del jugador
```

---

## 6. SISTEMA DE MISIONES

Las misiones son desafios temporizados a los que los jugadores envian a sus desarrolladores. Mientras esta en una mision, el desarrollador queda bloqueado de la simulacion — no puede realizar acciones autonomas hasta que la mision termine y se reclame la recompensa.

**Como Funciona:**
1. Elegir una mision de la lista disponible
2. Asignar un desarrollador que cumpla los requisitos de stats
3. El desarrollador queda bloqueado durante la duracion de la mision
4. Cuando el temporizador termina, reclamar la recompensa ($NXT agregados al balance del dev)
5. El desarrollador vuelve al estado activo
6. Cooldown de 24 horas antes de que el mismo dev pueda repetir la misma mision

**Slots de Misiones por Tamano del Jugador:**
- Misiones Easy, Medium y Hard: Siempre disponibles
- Misiones Extreme: Requieren 5+ devs en propiedad
- Misiones Legendary: Requieren 10+ devs en propiedad

### Todas las Misiones Disponibles

#### Misiones Faciles (1 hora)

| Mision | Recompensa | Stat Requerido |
|--------|-----------|----------------|
| Attend a Standup Meeting | 15 NXT | Ninguno |
| Fix a Typo in Production | 20 NXT | Coding 30+ |
| Reply All Damage Control | 25 NXT | Ninguno |
| Explain Crypto to Your Mom | 15 NXT | Social 20+ |

#### Misiones Medias (2-4 horas)

| Mision | Recompensa | Duracion | Requisitos |
|--------|-----------|----------|------------|
| Infiltrate a Competitor Hackathon | 40 NXT | 2h | Hacking 40+ |
| Survive a Code Review from Hell | 60 NXT | 3h | Coding 50+ |
| Debug Smart Contract at 3 AM | 80 NXT | 4h | Coding 60+, 3 devs |
| Pitch to VCs Without Using "AI" | 50 NXT | 2h | Social 50+ |
| Liquidate a Degen Position | 70 NXT | 3h | Trading 60+ |

#### Misiones Dificiles (6-12 horas)

| Mision | Recompensa | Duracion | Requisitos |
|--------|-----------|----------|------------|
| Corporate Espionage at Zuck Labs | 150 NXT | 6h | Hacking 70+, 3 devs |
| Ship a Feature Before Deadline | 250 NXT | 12h | Coding 70+, 5 devs |
| Survive a Bear Market | 180 NXT | 8h | Endurance 60+, 3 devs |
| Negotiate Partnership with Misanthropic | 200 NXT | 6h | Social 70+, 5 devs |
| Audit a Spaghetti Contract | 200 NXT | 8h | Coding 80+, 3 devs |

#### Misiones Extremas (12-24 horas)

| Mision | Recompensa | Duracion | Requisitos |
|--------|-----------|----------|------------|
| Launch Protocol from Zero | 500 NXT | 24h | Coding 80+, 5 devs |
| Survive Congressional Hearing | 350 NXT | 12h | Social 80+, 5 devs |
| 48-Hour Hackathon Solo | 450 NXT | 24h | Coding 85+, 10 devs |

#### Misiones Legendarias (24 horas)

| Mision | Recompensa | Requisitos |
|--------|-----------|------------|
| Overthrow a Corporation | 1,000 NXT | Hacking 90+, 10 devs |
| Solve P=NP (Accidentally) | 2,000 NXT | Coding 95+, 20 devs |

---

## 7. SISTEMA DE TIERS

El sistema de tiers recompensa a los jugadores que hacen crecer su equipo de desarrolladores. A medida que minteas mas desarrolladores, desbloqueas acceso a programas y herramientas cada vez mas poderosos.

### Progresion de Tiers

| Tier | Icono | Min Devs | Nombre |
|------|-------|----------|--------|
| 1 | 💻 | 1 | Solo Coder |
| 2 | 🏠 | 3 | Indie Lab |
| 3 | 🚀 | 5 | Startup HQ |
| 4 | 🏢 | 10 | Dev House |
| 5 | 🏭 | 20 | Tech Corp |
| 6 | 🌆 | 50 | Mega Corp |
| 7 | 👑 | 100 | Empire |

### Que Desbloquea Cada Tier

| Tier | Programas Desbloqueados |
|------|------------------------|
| **💻 Solo Coder** (1 dev) | NX Terminal, Live Feed, My Devs, NXT Wallet, Mint/Hire Devs, Inbox, Notepad, Recycle Bin, Settings, Mission Control |
| **🏠 Indie Lab** (3 devs) | World Chat, Leaderboard, NX Dev Academy |
| **🚀 Startup HQ** (5 devs) | Protocol Market, AI Lab, Corp Wars, Mega Sentinel |
| **🏢 Dev House** (10 devs) | Mega City, Mega Build, MegaWatch |
| **🏭 Tech Corp** (20 devs) | Flow, Nadwatch, Parallax |
| **🌆 Mega Corp** (50 devs) | *Programas futuros* |
| **👑 Empire** (100 devs) | *Programas futuros* |

El sistema de tiers crea un ciclo natural de incentivos: mas desarrolladores significa mas programas para usar, lo que significa mas valor de la plataforma, lo que motiva a mintear mas desarrolladores. Cada nuevo tier se siente como desbloquear un ala nueva del sistema operativo.

---

## 8. PROGRAMAS DEL PORTAL — HERRAMIENTAS PARA USUARIOS DE MEGAETH

NX Terminal no es solo un juego — es un portal completamente funcional con mas de 20 programas. Esto es lo que hace cada uno:

### NX Terminal (>_) — Pantalla de Inicio del Sistema
La ventana principal de la terminal. Muestra specs de hardware simulados, parametros de simulacion, y la historia satirica de las Protocol Wars. Es la pagina "acerca de" del sistema operativo, presentada como una secuencia de arranque. Un buen punto de partida para nuevos usuarios.

### Live Feed (>>) — Stream de Actividad en Tiempo Real
Un feed scrolleable de todo lo que esta pasando en toda la simulacion en tiempo real. Mira a los desarrolladores codear, tradear, hackear y chatear — todo codificado por colores segun arquetipo. Pensalo como un feed de Twitter del universo de tu simulacion. Usa WebSocket para actualizaciones instantaneas.

### My Devs (=) — Dashboard de Gestion de Desarrolladores
Tu centro de control para todos los desarrolladores que posees. Ve los stats de cada dev, personalidad, arquetipo, nivel de energia, salud del PC, balance y actividad actual. Desde aca podes alimentarlos, entrenarlos, enviarlos a misiones o fixear sus bugs. Cada dev tiene una pagina de perfil detallada.

### NXT Wallet ($) — Wallet de Tokens
Una wallet de criptomonedas completa para tokens $NXT. Muestra tu balance on-chain, historial de transacciones, depositos de salario y recibos de pago detallados con desglose de fees. Trackea activos e historial de transferencias. Aca es donde reclamas el salario ganado de tus desarrolladores.

### Hire/Mint Devs (+) — Interfaz de Minteo de NFTs
El programa principal de minteo. Conecta tu wallet, paga en ETH, y mintea nuevos NFTs de desarrolladores. Incluye una animacion de despliegue que simula "contratar" a tu nuevo dev, seguida de una revelacion del perfil mostrando sus stats generados aleatoriamente, arquetipo, corporacion, especie y rareza.

### World Chat (#) — Sala de Chat Global
*Se desbloquea en Indie Lab (3 devs).* Una sala de chat entre corporaciones donde todos los jugadores pueden comunicarse en tiempo real. Discutir estrategias, coordinar, compartir tips, o simplemente pasar el rato. Los mensajes se sincronizan cada 10 segundos. Separado del chat de devs IA — esto es humano a humano.

### Leaderboard (*) — Rankings
*Se desbloquea en Indie Lab (3 devs).* Rankings multi-pestana mostrando los mejores desarrolladores y corporaciones por balance, rendimiento, reputacion y metricas de dominancia. Ve quien lidera la simulacion y como se compara tu equipo.

### Protocol Market ($) — Mercado de Protocolos
*Se desbloquea en Startup HQ (5 devs).* Navega y tradea protocolos creados por desarrolladores en la simulacion. Cada protocolo tiene graficos de precio en vivo, puntajes de calidad e historial de inversiones. Un mercado simulado que refleja interfaces reales de trading DeFi.

### AI Lab (~) — Votacion de Experimentos IA
*Se desbloquea en Startup HQ (5 devs).* Los desarrolladores autonomamente crean experimentos absurdos de IA con nombres y descripciones descabelladas. Los jugadores votan por sus favoritos usando un sistema de votacion ponderada (diferentes arquetipos tienen diferente poder de voto). Las IAs mas votadas ganan bonus de $NXT para sus creadores.

### Corp Wars — Batallas Territoriales
*Se desbloquea en Startup HQ (5 devs).* Una visualizacion de la competencia corporativa a traves de sectores geograficos. Mira a las seis corporaciones (CLOSED_AI, MISANTHROPIC, SHALLOW_MIND, ZUCK_LABS, Y_AI, MISTRIAL_SYSTEMS) batallar por territorio con puntuacion en tiempo real basada en el rendimiento colectivo de sus desarrolladores.

### Mega City — Visualizacion 3D de la Ciudad
*Se desbloquea en Dev House (10 devs).* Una ciudad 3D isometrica generada proceduralmente, alimentada por datos en vivo de la blockchain de MegaETH. Edificios, calles y decoraciones se animan basados en la produccion real de bloques, volumen de transacciones y precios de gas. Una representacion visual del latido de MegaETH.

### MegaWatch — Vigilancia de Red
*Se desbloquea en Dev House (10 devs).* Un dashboard en tiempo real que monitorea los signos vitales de MegaETH: ultimos bloques, throughput de transacciones, precios de gas, TPS (transacciones por segundo), e indicadores de salud de la red. Graficos en vivo y datos auto-refrescantes. Usa MegaETH RPC para datos en vivo.

### NX Dev Academy (DA) — Plataforma de Entrenamiento
*Se desbloquea en Indie Lab (3 devs).* Una plataforma educativa interactiva con rutas de aprendizaje estructuradas. Ofrece cursos sobre fundamentos de blockchain, smart contracts, y temas especificos de MegaETH. Incluye misiones de quiz y desafios de codigo. Los jugadores ganan XP y trackean progresion a traves de tracks de lecciones.

### Mega Build — IDE de Smart Contracts
*Se desbloquea en Dev House (10 devs).* Un entorno completo de desarrollo de smart contracts en el navegador. Incluye plantillas de Solidity, herramientas de compilacion, guias de despliegue, y capacidades de testing en vivo contra MegaETH. Pensalo como un Remix IDE simplificado incrustado dentro del escritorio de NX Terminal.

### Mission Control — Gestion de Misiones
Tu cuartel general de misiones. Navega misiones disponibles filtradas por dificultad, asigna desarrolladores que cumplan requisitos de stats, monitorea misiones en progreso, y reclama recompensas cuando se completen. Ve la Seccion 6 para detalles completos de misiones.

### Notepad (N) — Editor de Texto
Un editor de texto simple precargado con notas satiricas sobre la cultura blockchain, incluyendo archivos readme falsos, fracasos de trading y lore del juego. Los jugadores tambien pueden escribir sus propias notas.

### Recycle Bin (x) — Archivo de Archivos Eliminados
Una coleccion humoristica de "archivos eliminados" que se burlan de la cultura crypto — seed phrases perdidas, colecciones de NFT fallidas, bots de trading abandonados, y decisiones de inversion lamentables. Puro entretenimiento.

### Settings (::) — Panel de Control
Configuraciones del sistema para personalizar tu escritorio: seleccion de wallpaper (teal, corporate blue, matrix, clouds, terminal), cambio de tema (clasico, oscuro, alto contraste), configuracion de protector de pantalla, y toggle de asistente IA.

### Inbox (M) — Sistema de Email
Una bandeja de entrada con mensajes de bienvenida, documentacion del juego, y notificaciones. Trackea mensajes no leidos con un badge de conteo en la barra de tareas.

### Flow, Nadwatch, Parallax — Analiticas Avanzadas
*Se desbloquean en Tech Corp (20 devs).* Tres programas avanzados para usuarios expertos: Flow provee analiticas de wallet y visualizacion de flujo de tokens; Nadwatch ofrece analisis profundo de red con seguimiento de consenso y ejecucion paralela; Parallax visualiza las lanes de ejecucion paralela de transacciones de MegaETH.

---

## 9. MEGA SENTINEL — SUITE DE SEGURIDAD

*Se desbloquea en Startup HQ (5 devs).*

Mega Sentinel es un toolkit de seguridad dedicado con cinco modulos especializados disenados para proteger a los usuarios de MegaETH de estafas, rug pulls y contratos maliciosos. Cada modulo se enfoca en un aspecto diferente de la seguridad blockchain.

### XRAY.mega — Escaner de Tokens + Deteccion de Honeypots

**Que hace:** Realiza un analisis de seguridad integral de cualquier token en MegaETH. Ingresa una direccion de contrato y XRAY lo escanea en multiples dimensiones para producir un puntaje de riesgo de 0 a 100.

**El analisis incluye:**
- Verificacion de bytecode del contrato (es el codigo legitimo?)
- Inspeccion de metadata ERC-20 (nombre, simbolo, decimales, supply)
- Deteccion de honeypot (simula compra y venta para verificar si realmente podes vender)
- Checks de estado del owner (puede el dueno pausar el trading? bloquear wallets? actualizar el contrato?)
- Precio en tiempo real, cambio 24h, liquidez, volumen y market cap

**Niveles de Riesgo:** SAFE, WARNING, DANGER, CRITICAL

**Fuentes de Datos:** Blockchain MegaETH (llamadas RPC directas), API de DexScreener para datos de mercado, analisis de bytecode de smart contracts.

### FIREWALL.exe — Antivirus de Wallet + Revocacion

**Que hace:** Escanea tu wallet conectada para todos los approvals activos de tokens (permisos que le diste a smart contracts para gastar tus tokens) y te ayuda a revocar los peligrosos con un solo click.

**Caracteristicas:**
- Escanea todos los approvals de tokens ilimitados y limitados
- Clasifica cada approval por riesgo (SAFE, WARNING, DANGER, CRITICAL)
- Identifica si el spender es un contrato verificado o una direccion desconocida
- Puntaje de salud de wallet basado en la exposicion total de approvals
- Revocacion con un click de approvals riesgosos

**Fuentes de Datos:** Wallet del usuario conectada via Wagmi, logs de eventos de approval on-chain, datos de verificacion de contratos.

### RUG AUTOPSY — Analisis Forense

**Que hace:** Investiga tokens que pueden haber sido "rug pulled" (cuando el creador drena la liquidez y desaparece con los fondos de los inversores). Ingresa una direccion de token sospechoso y obtene un reporte forense completo.

**El analisis incluye:**
- Perfil del deployer (quien creo este token? que mas ha desplegado?)
- Deteccion de deployer serial (esta direccion ha creado y ruggeado multiples tokens?)
- Timeline de eventos (mint, burn, liquidez agregada/removida, listado en DEX)
- Estimacion de dano (USD perdidos, numero de wallets afectadas, liquidez drenada)
- Historial de todos los tokens previos del mismo deployer con su estado actual

**Clasificaciones de Veredicto:** LIKELY_RUG, SERIAL_RUGGER, SUSPICIOUS, INCONCLUSIVE, CLEAN

**Fuentes de Datos:** Logs de eventos de blockchain, historial de transacciones del deployer, seguimiento de pools de liquidez.

### HOLOGRAM DETECTOR — Verificacion de Legitimidad

**Que hace:** Verifica si un token es autentico o una copia falsa. Muchos tokens estafa se hacen pasar por proyectos populares — HOLOGRAM chequea multiples puntos de verificacion para determinar legitimidad.

**Caracteristicas:**
- Puntaje de legitimidad de 0-100%
- Verificacion multi-punto contra registros de proyectos conocidos
- Deteccion de proyectos verificados de MegaETH
- Barras de progreso visuales mostrando resultados de checks individuales
- Clasificacion de nivel: LEGITIMATE, LIKELY_LEGIT, SUSPICIOUS, LIKELY_FAKE

**Fuentes de Datos:** Registro de proyectos MegaETH, verificacion de metadata de contratos, bases de datos de proyectos conocidos.

### GRADUATION TRACKER — Monitor de Ciclo de Vida de Tokens

**Que hace:** Trackea tokens emergentes y monitorea su progresion a traves de etapas del ciclo de vida. Pensalo como un radar para nuevos tokens en MegaETH.

**Caracteristicas:**
- Monitoreo en tiempo real del estado de tokens (trending, graduating, active, dead)
- Vistas filtrables por categoria de estado
- Metricas de tokens: precio, cambio 24h, volumen, liquidez, market cap, edad, DEX
- Paginacion (20 tokens por pagina) con capacidad de refresh

**Fuentes de Datos:** APIs del ecosistema MegaETH, feeds de precios en tiempo real, datos de DEX.

---

## 10. ACTIVIDAD ON-CHAIN

NX Terminal genera actividad significativa en blockchain a traves del gameplay normal. Esto es lo que crea transacciones en MegaETH:

**Transacciones Iniciadas por el Jugador:**

| Accion | Tipo de Transaccion |
|--------|-------------------|
| Mintear un desarrollador | Mint de NFT (transferencia de ETH + cambio de estado) |
| Reclamar salario | Llamada claimNXT() + minteo de token NXT |
| Revocar approval (Firewall) | Revocacion de approval de token |
| Conexion de wallet | Verificacion de firma |

**Transacciones Iniciadas por el Backend:**

| Accion | Tipo de Transaccion |
|--------|-------------------|
| Sync de salario | batchSetClaimableBalance() (lotes de 200 devs) |
| Distribucion de fees | Mint de NXT al treasury |

**Actividad Estimada por Jugador Activo por Dia:**
- ~1-3 transacciones de claim
- ~1-5 interacciones de tienda/misiones (off-chain, sincronizadas en lotes)
- ~1 lote de sync de salario (cubre todos los devs del jugador)

**Potencial de Escalamiento:**
Con 35,000 NFTs de desarrolladores maximos y miles de jugadores activos, la simulacion podria generar decenas de miles de transacciones diarias — todas a costo casi nulo gracias a los fees bajos de MegaETH. El sistema de sync por lotes (200 devs por transaccion) mantiene los costos on-chain manejables incluso a escala completa.

---

## 11. ARQUITECTURA TECNICA

### Stack Tecnologico

| Capa | Tecnologia | Detalles |
|------|-----------|----------|
| **Frontend** | React 19 + Vite 7 | App de pagina unica con estilo CSS Windows 98 |
| **Backend** | FastAPI (Python 3.11) | Servidor ASGI asincrono con Uvicorn, 2 workers |
| **Base de Datos** | PostgreSQL 15+ | Tablas particionadas para acciones y chat (escrituras de alto volumen) |
| **Cache/Mensajeria** | Redis | Pub/sub WebSocket para feed en vivo, cache de sesion |
| **Blockchain** | Solidity (EVM) | NXDevNFT (ERC-721) + NXTToken (ERC-20) en MegaETH |
| **Cliente Web3** | Wagmi + Viem | Conexion de wallet, interacciones con contratos |
| **Despliegue** | Render | Infraestructura como codigo via render.yaml |

### Motor de Simulacion

El motor de simulacion es el corazon de NX Terminal. Decisiones clave de diseno:

- **Sin LLM / Sin API de IA:** Toda la simulacion corre con algoritmos de random ponderado con matrices de personalidad y modificadores contextuales. Esto significa **$0/mes en costos de API de IA**, sin importar cuantos desarrolladores esten activos.
- **Algoritmo de Decision:** `random.choices(actions, weights=probabilities)` — simple, rapido, deterministico dado el mismo seed.
- **Generacion de Contenido:** Todos los nombres de protocolos, experimentos de IA y mensajes de chat se generan desde plantillas combinatorias (37 prefijos x 28 nucleos x 30 sufijos = 30,000+ nombres unicos de protocolos).
- **Procesamiento por Lotes:** El motor procesa hasta 500 desarrolladores por tick con 4 hilos de trabajo paralelos.
- **Scheduler:** Chequea desarrolladores pendientes de actuar cada 1 segundo, respetando velocidades de ciclo dinamicas basadas en energia.

### Arquitectura de Despliegue

| Servicio | Tipo | Rol |
|----------|------|-----|
| **nx-api** | Web Service (Starter) | Servidor FastAPI manejando todas las peticiones API y conexiones WebSocket |
| **nx-engine** | Worker Service (Starter) | Corre el motor de simulacion continuamente en segundo plano |
| **nx-db** | PostgreSQL (Starter) | Base de datos primaria para todo el estado del juego |
| **nx-redis** | Redis (Free) | Mensajeria en tiempo real para feed en vivo WebSocket |

**Costo Mensual Estimado:** ~$14-25/mes (planes Starter de Render + tier gratis de Redis). El diseno de cero-costo-de-API del motor de simulacion mantiene los gastos operativos extremadamente bajos sin importar la cantidad de jugadores.

---

## 12. ROADMAP / PLANES FUTUROS

Basandose en la arquitectura actual y los sistemas de juego, estos son los proximos pasos logicos para NX Terminal:

**Corto Plazo:**
- **Mas Misiones:** Expandir el pool de misiones mas alla de 19 con misiones estacionales y basadas en eventos
- **Features Sociales:** Propinas entre jugadores, alianzas de devs y misiones en equipo
- **Sistema de Logros:** Badges y milestones por logros de jugadores
- **App Companion Movil:** Revisar devs, reclamar salario y gestionar misiones desde el celular

**Mediano Plazo:**
- **Protocol Market On-Chain:** Mover la compra/venta de protocolos a smart contracts para trading trustless entre jugadores
- **Corp Wars On-Chain:** Stakear tokens $NXT para atacar corporaciones rivales con resolucion y recompensas on-chain
- **Marketplace de Devs:** Compra/venta de NFTs de desarrolladores en un marketplace nativo con precios basados en stats

**Largo Plazo:**
- **Governance con $NXT:** Los holders de tokens votan sobre parametros del juego, nuevas features y gastos del treasury
- **Expansion Cross-Chain:** Bridge de $NXT a otras chains para participacion DeFi mas amplia
- **Simulacion Avanzada:** Comportamientos de desarrolladores mas complejos, politica inter-corporativa y sistemas economicos emergentes
- **Estructura DAO:** Transicionar governance a una organizacion autonoma descentralizada operada por holders de $NXT

---

## 13. METRICAS CLAVE (Estado Actual)

Las siguientes metricas estan disponibles en tiempo real via la API de simulacion (`/api/simulation/stats`):

| Metrica | Descripcion |
|---------|-------------|
| **Total Devs Minteados** | Total de NFTs de desarrolladores creados (max: 35,000) |
| **Devs Activos** | Desarrolladores actualmente activos en la simulacion |
| **Total $NXT en Wallets** | Suma de todos los balances de desarrolladores en la simulacion |
| **Total Protocolos Creados** | Protocolos acumulados construidos por todos los desarrolladores |
| **Total IAs Creadas** | Experimentos de IA acumulados generados |
| **Energia Promedio** | Nivel de energia promedio de todos los desarrolladores activos |
| **Reputacion Promedio** | Puntaje de reputacion promedio de todos los desarrolladores |
| **Protocolos Activos** | Protocolos actualmente activos en el marketplace |
| **Misiones Disponibles** | 19 misiones en 5 niveles de dificultad |
| **Supply Maximo $NXT** | 1,000,000,000 (1 billon de tokens) |

### Direcciones de Contratos

| Contrato | Direccion | Chain |
|----------|-----------|-------|
| **NXDevNFT** | `0x5fe9Cc9C0C859832620C8200fcE5617bEfE407F7` | MegaETH (4326) |
| **NXTToken** | `0x2F55e14F0b2B2118d2026d20Ad2C39EAcBdCAc47` | MegaETH (4326) |

### Links

| Recurso | URL |
|---------|-----|
| **Portal** | nxterminal.xyz |
| **Chain** | MegaETH Mainnet (Chain ID: 4326) |
| **RPC** | mainnet.megaeth.com/rpc |

---

*NX Terminal: Protocol Wars — Donde desarrolladores IA autonomos construyen, hackean, tradean y compiten en MegaETH.*
