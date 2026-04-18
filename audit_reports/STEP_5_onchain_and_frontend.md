# Paso 5 — Contratos on-chain y Frontend

## Resumen ejecutivo

Stack on-chain: NXTToken ERC-20 (1B cap, burn/mint circular) + 
NXDevNFT ERC-721 (35k supply, hold claimable balances por tokenId). 
Backend signer tiene 11 permisos privilegiados sobre el segundo.

Frontend: NxtWallet.jsx monolito de 880 líneas sin abstracciones. 
Tres bugs latentes que afectarían seriamente a NX_FUTURES: 
timeout-asume-éxito, deducciones ficticias en UI, polling 90s 
sin WebSocket.

Hallazgo más grave: mismatch entre source v3/v4 en repo y bytecode 
deployado v8/v9 en prod. Rescuable vía explorer verificado.

## 5.1 Contratos on-chain

### NXTToken
- Address: 0x2F55e14F0b2B2118d2026d20Ad2C39EAcBdCAc47
- Red: MegaETH mainnet (chainId 4326)
- Stack OZ: ERC20, ERC20Burnable, Ownable, ReentrancyGuard, Pausable
- Cap: 1_000_000_000 NXT (1B, constante)
- Supply inicial: 0 (todo minteado via claimNXT)
- Minter: mapping isMinter[address] — debe incluir a NXDevNFT
- Burn configurable: gameBurn (approvedBurner), burnEnabled toggle, 
  auto-burn on transfer con exemptions

### NXDevNFT
- Address: 0x5fe9Cc9C0C859832620C8200fcE5617bEfE407F7
- Stack OZ: ERC721, ERC721Enumerable, Pausable, Ownable, 
  ReentrancyGuard
- NO upgradeable (no proxy)
- Supply cap: 35,000 NFTs
- Holds: claimableBalance[tokenId] mapping
- claimNXT(tokenIds[]): user llama, mintea NXT al user y fee al treasury
- 11 funciones privilegiadas accesibles por backendSigner (ver paso 4B)

### Roles cruzados
- NXDevNFT debe estar en NXTToken.isMinter (seteado post-deploy)
- NXDevNFT.claimNXT mintea NXTToken via nxtToken.mint
- NXTToken no está pre-mintado — todo sale de claimNXT

### Treasury y signers (EOAs, no contratos)
- Treasury: 0x31d6E19aAE43B5E2fbeDb01b6FF82AD1e8B576DC
- Backend signer: derivada de BACKEND_SIGNER_PRIVATE_KEY

## 5.2 Hallazgos críticos on-chain

### 5.2.1 Mismatch repo vs producción
- Source en repo: NXTToken_v3, NXDevNFT_v4
- Deployado en prod: v8/v9 (según comentarios en backend)
- Imposible auditar código real desde este repo
- v4 tiene CLAIM_FEE_BPS=1000 (10%), comentarios en prod dicen v8 
  sin fee → divergencia que el frontend nunca validó

Fix: descargar source verificado del explorer y commitear al repo.

### 5.2.2 Direcciones hardcoded en múltiples lugares
- frontend/src/services/contract.js
- backend/engine/claim_sync.py
- Si alguna cambia sin la otra, el sistema rompe sin warning

### 5.2.3 Backend no escucha NXTClaimed on-chain
- El listener solo busca Transfer events de deposits al treasury
- Claims directos al contrato (sin frontend) quedan invisibles al backend
- claim_history puede divergir de la realidad on-chain

### 5.2.4 Burn del shop no se refleja on-chain
- Shop resta balance_nxt en DB pero nunca llama gameBurn
- NXT quemados en shop nunca existieron on-chain (ya no estaban 
  minteados) → players.total_spent incluye burns ficticios

### 5.2.5 Cero auditoría externa documentada
- No hay link a Certik, OpenZeppelin, Trail of Bits, Code4rena
- Contrato con cap de 1B tokens y rol catastrófico sin review

## 5.3 Frontend — NxtWallet.jsx

### Arquitectura
- Archivo: frontend/src/windows/NxtWallet.jsx (~880 líneas)
- Monolito con 5+ sub-componentes anidados
- Sin separación de concerns
- Sin tests visibles

### Diferenciación visual off-chain vs on-chain
Implementada correctamente. Dos cards lado a lado:
- IN-GAME BALANCE (amarillo, off-chain, summary.balance_claimable)
- WALLET BALANCE (verde, on-chain, via eth_call balanceOf)

Terminología user-friendly evita jerga técnica.

### Estados del claim (state machine claimStep)
idle → signing → syncing → mining → success / error

### Pay Stub con deducciones ficticias
- 5 "deducciones" (Health, Digital Life, Union, Anti-Hack, Income Tax)
- Suman 10% (mismo que CLAIM_FEE_BPS en v4)
- Son inventadas para UX narrativa
- Si v8 no tiene fee real, user ve deducciones que no ocurren

### Actualización de datos
- Polling cada 90s (setInterval)
- WebSocket existe en el codebase (useWebSocket.js) pero NO se usa
- Post-claim: refresh manual vía refreshWalletBalance()

## 5.4 Hallazgos críticos frontend

### 5.4.1 Timeout-asume-éxito (bug activo)
Línea 304-307 de NxtWallet.jsx:
- Si waitForReceipt timeout (60s) → setClaimStep('success')
- User ve ✅ aunque la tx pudo haber revertido
- Combinado con wait_for_receipt=False del backend + record-claim 
  fire-and-forget → 3 puntos donde un claim puede perderse 
  silenciosamente

### 5.4.2 record-claim fire-and-forget
- .catch(() => {}) silencia fallos
- Si el POST falla, user no se entera
- claim_history queda incompleto

### 5.4.3 Deducciones ficticias en UI
- Usuarios aprenden a esperar deducciones que no existen
- Problema cultural: bloquea cobro de fees reales en NX_FUTURES
- Divergencia posible entre preview y NXT real recibido

### 5.4.4 RPC hardcoded en múltiples archivos
- mainnet.megaeth.com/rpc repetido 3+ veces sin centralizar
- Cambiar de RPC requiere editar N archivos

### 5.4.5 Polling 90s sin WebSocket
- UX lento para trading (cambios de precio no visibles hasta refresh)
- Bajarlo satura los 8 workers de uvicorn
- Trade-off sin resolver

## 5.5 Ausencia de abstracciones reusables

### Lo que NO existe (y sería necesario para NX_FUTURES)
- useBalance(walletAddress, tokenAddress) hook
- useClaim() hook
- useSignAndSendTx({abi, address, fn, args}) con state machine
- <TxStatusModal /> component
- <DualBalance /> extensible a N balances
- <TxHashLink /> (3 copias duplicadas)
- <AmountInput /> con validación contra balance

### Consecuencia
Construir NX_FUTURES encima sin refactorizar propagaría los bugs 
actuales (timeout-asume-éxito, deducciones ficticias, fire-and-forget) 
a cada nueva feature de trading.

## 5.6 Implicaciones para NX_FUTURES

### Requisitos antes de construir NX_FUTURES

1. Descargar source v8/v9 del explorer y commitear al repo
2. Decidir qué hacer con las deducciones ficticias (remover o hacerlas reales)
3. Agregar event listener de NXTClaimed al backend
4. Refactorizar NxtWallet.jsx: extraer hooks y componentes reusables
5. Implementar WebSocket push para actualizaciones en vivo
6. Centralizar config de RPC y direcciones de contratos

### Estrategia on-chain para NX_FUTURES

- NO deployar contrato nuevo de markets. Todo off-chain.
- Reusar NXTToken existente. Backend signer debe estar en 
  isMinter (ya está) o usar treasury pre-fondeado.
- Settle de mercados off-chain (actualización de balances en DB)
- CLAIM unificado al wallet on-chain (mismo endpoint que misiones)

### Planning de audit externo

Pre-launch de NX_FUTURES con volumen real, considerar:
- Code4rena / Sherlock (contests competitivos, ~15-30k USD)
- OpenZeppelin Audits / Trail of Bits (tradicional, 50-150k USD)
- Solo auditar NXTToken + NXDevNFT deployados
- NX_FUTURES al ser off-chain no requiere audit de contratos

## 5.7 Fixes acumulados pre-NX_FUTURES (paso 5)

Suma a la lista de pasos 2+3+4:

29. Descargar source v8/v9 del explorer y commitear al repo
30. Actualizar docstrings en claim_sync.py y players.py con versión real
31. Verificar ABI del frontend sincronizado con v9 deployado
32. Centralizar CONTRACT_ADDRESSES en un solo archivo 
    importado por frontend y backend
33. Agregar event listener de NXTClaimed en backend/engine/listener.py
34. Remover deducciones ficticias del pay stub si v8/v9 no tiene fee
35. Refactorizar NxtWallet.jsx: extraer useBalance, useClaim, 
    useSignAndSendTx, TxStatusModal, DualBalance, TxHashLink
36. Cambiar timeout-asume-éxito por timeout-marca-pending-manual-check
37. Implementar WebSocket push en useWebSocket.js para reemplazar polling 90s
38. Agregar endpoint backend para burn real on-chain (llamar gameBurn) 
    si querés que el burn del shop sea visible on-chain
39. Planear audit externo de NXTToken + NXDevNFT pre-launch
