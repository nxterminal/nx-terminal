# 03a · Inbox (NX Mail)

Fuente: `frontend/src/windows/Inbox.jsx` (sin CSS-module asociado; estilos inline + clases `win-*` globales).

## Estructura visual

### 1. Toolbar (top)
- Fondo `var(--win-bg)`, borde inferior `var(--border-dark)`, font-size `--text-sm`.
- Contenido: `**NX Mail**  |  N unread  |  [✉ New]` (separadores `|` en `--text-secondary`).
- En modo seleccionado/compose/lectura cambia a botones `[Back to Inbox]`, `[Mark as Read (n)]`, `[Delete (n)]`, `[Clear]`.

### 2. Tabs de grupo (debajo del toolbar)
- Botones planos con `border-bottom: 2px solid var(--selection)` cuando activos. Negrita activa, gris (`--text-muted`) inactivos.
- Grupos dinámicos: siempre `Inbox`; luego `NX Terminal System`, `Other`, `Sent` según remitentes presentes; `Support Tickets` solo para wallets admin.
- Cada tab muestra contador de no-leídos entre paréntesis: `Inbox (3)`.

### 3. Lista de emails (tabla `.win-table`)
| Columna | Ancho | Contenido |
|---|---|---|
| ☐ | 24px | Checkbox de selección múltiple. |
| status | 20px | `>` (no-leído) o `-` (leído). |
| From | flex, max 180px | Nombre antes del `<email>`, truncado con ellipsis. |
| Subject | flex | Asunto. |
| Date | 100px | `Mon DD, YYYY`; click ordena asc/desc (▲/▼). |

- Filas no-leídas: `font-weight: bold`; leídas: normal.
- Hover: `background: var(--selection)` + `color: var(--selection-text)` (regla global de `.win-table`).
- Selección múltiple: row con fondo `var(--selection)`.
- Lista vacía: fila única "No messages in this group" en itálica `--text-secondary`.

### 4. Email abierto (vista detalle)
Render dentro del mismo panel (reemplaza la lista):
```
┌─────────────────────────────────────────────┐
│ <Subject>                       (bold, --text-base)
│ From: <Sender Name <addr@nxterminal.corp>>  (--text-xs --text-secondary)
│ Date: Mon DD, YYYY                          (--text-xs --text-secondary)
├─────────────────────────────────────────────┤  ← border-bottom --border-dark
│ <Body>                                      (pre-wrap, Tahoma --text-sm, line-height 1.5)
│ ...
└─────────────────────────────────────────────┘
```
Campos del objeto email (ver `notifToEmail`, líneas 43-57):
`{ id, notifId, notifType, from, subject, date, dateRaw, read, body, sentByMe }`

## Email de bienvenida — ¿hardcoded?

**NO.** Inbox.jsx no contiene texto literal de un welcome email. Los mensajes vienen 100% del backend vía:
```js
api.getNotifications(wallet)
  .filter(n => ALLOWED_NOTIF_TYPES.has(n.type))
  .map(notifToEmail)
```
Para tipo `welcome`, el componente solo asigna el remitente:
```js
welcome: 'NX Terminal System <system@nxterminal.corp>'
```
El `subject` y `body` del email de bienvenida se generan en backend (probablemente `backend/api/routes/...` o un seed de notifications). En `Desktop.jsx:155` se referencia un id legacy `'welcome-1'` para el badge inicial, lo que sugiere que existió/existe un seed con ese id.

> **PLACEHOLDER trailer:** copy real del welcome email pendiente — buscar en backend (`grep -rn "welcome" backend/ | grep -iE "title|subject|body"`) en un archivo siguiente del trailer.

## Otros datos útiles para el trailer

- Mapeo completo `type → sender` (líneas 23-38) cubre 13 tipos: `welcome`, `broadcast`, `streak_claim`, `achievement`, `vip_welcome`, `vip_alert`, `vip_mint`, `dev_deployed`, `hack_received`, `world_event`, `prompt_response`, `ticket_sent`, `ticket_response`, `ticket_received`.
- Persistencia local: `localStorage['nx-inbox-emails']` guarda lista mergeada (preserva `read` local incluso si el backend lo reporta unread).
- Compose modal: `To:` fijo a "NX Terminal Support" (no editable), Subject ≤ 200, Body ≤ 2000 chars; al enviar dispara `api.submitTicket` y muestra `"Message sent. Ticket #N. HR will probably ignore it."`.
- Modal de borrado: titlebar "NX Terminal — Confirm Delete", copy: "⚠️ Are you sure you want to delete N email(s)? HR advises against destroying corporate correspondence."
