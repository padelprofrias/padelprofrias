# PadelHub — Sistema completo

Hub de competencia (estilo PRO CUP) + marcador en vivo + admin + Firebase.

## Páginas

| URL | Descripción |
|-----|-------------|
| `/` o `index.html` | Hub: actividades, ligas, noticias |
| `/ligas.html` | Ligas, tabla, fixture |
| `/torneos.html` | Torneos e inscripción WhatsApp |
| `/marcador.html` | Marcador cancha / TV / espectador |
| `/admin.html` | **Panel de administración** |

## Marcador — reglas incluidas

- Sorteo inicial de saque (jugador exacto)
- Indicador de quién saca + lado (derecha/izquierda)
- 1º / 2º saque, **Falta**, **Let**
- Rotación de saque entre parejas al ganar juego
- Punto de Oro (modal: qué jugador definió) o Ventaja (Ad)
- Tie-break, sets, historial, timer, undo
- Sync: Firebase + PeerJS + local

## Admin — qué gestiona

- Torneos (CRUD)
- Ligas (CRUD)
- Noticias (CRUD)
- Actividades del home (CRUD)
- Restaurar demo / exportar JSON

## Deploy Vercel

1. Subí la carpeta `padelhub` como root del proyecto.
2. Framework preset: **Other**.
3. Build command: vacío. Output: `.`
4. Tras el deploy:
   - `https://tu-dominio.vercel.app/admin.html`
   - `https://tu-dominio.vercel.app/marcador.html`

## Firebase

Config en `js/firebase-config.js`. Reglas:

```json
{
  "rules": {
    "matches": { "$code": { ".read": true, ".write": true } },
    "procup": { ".read": true, ".write": true }
  }
}
```

## Local

```bash
cd padelhub
python3 -m http.server 5500
```
