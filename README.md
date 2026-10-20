# MANZOLO RUSH

Un endless runner 3D a tre corsie: corri, salta, scivola e spara attraverso Sunset City, Dust Valley e Neon Outpost. Tutti i modelli, le texture e i suoni sono procedurali. HTML5, CSS e moduli JavaScript ES, **senza build e senza installazione di dipendenze** per giocare.

Three.js **0.169.0**, fissato nell’importmap di `index.html`, è l’unica dipendenza runtime e viene caricato da jsDelivr. Serve una connessione al CDN; la disponibilità offline dipende dalla cache del browser. Non vengono scaricati modelli, immagini, font, musica o altri asset.

## Avvio

Dalla cartella del progetto:

```sh
python3 -m http.server 8000
```

Apri **http://localhost:8000** e premi **INIZIA LA CORSA**. In alternativa `npm run serve` o `make serve` avviano lo stesso server. Non aprire `index.html` con `file://`: i moduli richiedono HTTP.

### Makefile

`make` (o `make help`) elenca i target: `serve`, `check`, `test`, `verify`, `sprites`, `build`, `up`, `down`, `logs`, `run`, `clean`. Le variabili `PORT`, `DOCKER_PORT`, `IMAGE` e `TAG` si passano sulla riga di comando (`make serve PORT=9000`).

### Docker

Il gioco è servito da nginx (`nginx:1.27-alpine`, configurazione in `nginx.conf` con MIME type per i moduli ES, gzip e cache degli asset):

```sh
make up        # docker compose up -d --build → http://localhost:8080
make logs      # segue i log
make down      # ferma e rimuove il container
```

Oppure senza compose: `make run` (immagine usa e getta su `DOCKER_PORT`). Three.js resta caricato dal CDN anche nel container.

Da smartphone, sulla stessa rete del computer, apri `http://IP-DEL-PC:8000` e consenti il traffico locale sulla porta 8000, se richiesto dal sistema. Sono supportati orientamento verticale e orizzontale. Serve un browser moderno con **WebGL 2**, importmap e Web Audio. L’audio si abilita dopo un’interazione; il pulsante ♫ lo attiva/disattiva e salva la preferenza.

## Comandi

| Azione | Tastiera / mouse | Touch | Gamepad standard |
| --- | --- | --- | --- |
| Corsia | ← / → oppure A / D | Swipe sinistra / destra | Stick sinistro / D-pad |
| Salto | ↑ / W / Spazio | Swipe in alto | A |
| Scivolata | ↓ / S | Swipe in basso | B |
| Colpo / fuoco continuo | Ctrl, J o click sul mondo; tieni per continuare | Tocca FUOCO per attivare/disattivare | RT |
| Raffica | Tieni Shift o K | Tieni FUOCO oltre 280 ms | RB |
| Pausa / ripresa | P / Esc, oppure pulsante Ⅱ | Pulsante Ⅱ / CONTINUA | Usa UI |

La perdita di focus o visibilità mette automaticamente in pausa e rilascia gli input. Il fuoco automatico touch va riattivato alla ripresa. Swipe e pulsante possono essere usati con due dita contemporaneamente.

## Regole e progressione

- **Tre vite**, più una vita extra ogni 5.000 punti fino a un massimo di 5 (`CONFIG.player.extraLifeEvery`, `maxLives`); sotto i cuori l’HUD mostra il prossimo traguardo. Ogni nemico abbattuto mostra i punti guadagnati (in oro quando c’è combo). Con Ctrl tenuto premuto meglio usare frecce e Spazio: Ctrl+W chiuderebbe la scheda del browser e non si può bloccare.
- 1,5 secondi di invulnerabilità dopo un danno: consentono di recuperare un errore mantenendo il ritmo. Lo scudo assorbe un colpo senza consumare una vita.
- Salto parabolico, cambio corsia in circa 150 ms e scivolata di 0,7 secondi. Salto e slide hanno un buffer di 180 ms prima dell’atterraggio/fine azione.
- La raffica riscalda il blaster: al 100% l’arma si blocca fino al 25%. Il fuoco normale è sostenibile.
- Soldati e pattugliatori cambiano corsia con movimento progressivo e inclinazione; i droni oscillano in volo, i tank hanno barra HP e assetto animato. Tutte le pose sono interpolate fra gli aggiornamenti della simulazione. I tipi più impegnativi si sbloccano gradualmente.
- Barriere da saltare, barre da oltrepassare in scivolata, treni da evitare e casse distruttibili che possono rilasciare bonus.
- Le monete si raccolgono solo nella corsia realmente occupata, anche durante i cambi. Il magnete raggiunge la stessa corsia e quelle immediatamente adiacenti, mai da un estremo all’altro.
- Bonus di 11 secondi: fuoco triplo sulle corsie, scudo, magnete e punti ×2. Raccogliere nuovamente lo stesso bonus ne rinnova la durata.
- Punteggio: distanza + monete + uccisioni; +15 per una barriera saltata e +10 per una barra superata in scivolata, assegnati una sola volta al passaggio completo (anche questi premi valgono il doppio con ×2). Uccisioni entro 3 secondi aumentano la combo fino a ×8; il bonus ×2 si applica ai punti guadagnati durante la sua durata.
- Un boss ogni 90 secondi di gioco: sentinella a figura intera con reattore pulsante, carica dei cannoni e rinculo. Ogni salva ha due muri di energia rossi (non si saltano e non si passa in scivolata) e, nella terza corsia, una barra arancione bassa da saltare o una sbarra sospesa sotto cui scivolare: i settori a terra la segnalano in anticipo insieme alla scritta SALTA/ABBASSATI. La corsia di riparo cambia a ogni salva e sotto il 40% di vita il boss spara più spesso. Il duello non ha limite di tempo: il boss resta finché non viene abbattuto. 
- Velocità iniziale 15 m/s, incremento graduale fino a 30 m/s. Le ambientazioni cambiano ogni 45 secondi, con colori, geometrie, nebbia e illuminazione differenti.
- Record, monete totali e audio sono salvati nella chiave `manzolo-rush-save` di localStorage (un salvataggio della vecchia chiave `neon-rush-save` viene letto e migrato automaticamente). I punti e le monete si registrano a fine corsa o tornando al menu. Storage indisponibile, pieno o corrotto non impedisce di giocare.

## Armi raccoglibili

Oltre al blaster, sulla strada (anello colorato a terra) e dentro le casse si trovano quattro armi a tempo (`CONFIG.guns.duration`, 14 s):

| Arma | Colpo | Danno | Particolarità |
| --- | --- | --- | --- |
| Sparpagliatore | 5 pallini a ventaglio | 1 ciascuno | corto raggio, copre la corsia |
| Plasma | sfera grande e lenta | 3 | trapassa 2 bersagli |
| Laser | raggio sottile e velocissimo | 2 | cadenza alta, trapassa 3 bersagli |
| Razzi | razzo lento | 6 | esplosione ad area (3,2 m) |

Raffica, surriscaldamento e fuoco triplo valgono per tutte. Nessuna arma perfora treni, barriere o boss. Tutti i parametri sono in `CONFIG.guns` (`src/game/config.js`). Lo sheet grafico opzionale delle armi è descritto in `PROMPT_SPRITES.md` (sezione 4): finché manca si usa il blaster tinto del colore dell’arma.

## Generazione e prestazioni

I pattern scritti a mano occupano al massimo due corsie e conservano una corsia di fuga. La via libera si sposta al massimo di una corsia tra righe successive. L’intervallo minimo lascia margine per lo spostamento e il passaggio di un treno. I pattugliatori non attraversano la corsia riservata e smettono di cambiare corsia vicino al giocatore. Durante il boss il percorso viene liberato, evitando combinazioni tra ostacoli e salve.

La logica usa un timestep fisso di 1/60 s e il rendering interpola posizioni. Nove chunk riciclati, pool fissi per entità e proiettili, monete e particelle con `InstancedMesh`, otto batch instanziati per lo scenario, materiali condivisi, ombra a texture canvas senza shadow map. Props raggruppati per texture e interpolati insieme alla strada. Pixel ratio massimo 2 con budget iniziale di 2 milioni di pixel; una media sotto 55 fps per 1,5 secondi riduce progressivamente la risoluzione fino a DPR 0,7. I cambi di risoluzione ridisegnano subito il canvas per evitare fotogrammi vuoti. In pausa camera, luci e trasformazioni rimangono congelate; il pannello non applica blur al canvas WebGL. L’interfaccia numerica si aggiorna circa 12 volte al secondo.

L’obiettivo è 60 fps su desktop e fluidità su smartphone medio; **le prestazioni GPU non sono state misurate in questa sandbox**.

## Bilanciamento

Tutti i valori principali sono in **`src/game/config.js`**. Modifica e ricarica: non c’è compilazione.

| Sezione | Cosa controlla |
| --- | --- |
| `player`, `speed` | Vite, hitbox, fisica, buffer, invulnerabilità, velocità e accelerazione |
| `spawn`, `enemyMix`, `intro` | Pesi dei pattern, intervalli, probabilità bonus/nemici, sblocchi e introduzione |
| `weapon`, `enemies`, `obstacles` | Cadenza, danni, calore, recupero, HP, punteggi e proiettili |
| `boss` | Frequenza, HP crescenti, durata, preavviso e ritmo degli attacchi |
| `bonuses`, `collection` | Durata bonus, combo, punteggi, raccolta e magnete |
| `world`, `THEMES` | Chunk, distanze e cambi d’ambiente |
| `performance`, `juice`, `audio` | Risoluzione adattiva, pool, effetti e suono |

Se modifichi corsie, hitbox, intervalli o velocità, riesegui i test sulla percorribilità. I valori geometrici dei modelli sono nei rispettivi moduli. `?debug` nell’URL espone `window.__game` per ispezionare stato, pool, tempi e `renderer.info`; nell’avvio normale il gioco non espone globali diagnostici.

## Asset grafici (sprite 2D)

Oltre ai modelli procedurali, il gioco usa gli sprite in **`assets/sprites/`** (WebP con trasparenza, ~350 KB in tutto; i PNG affiancati servono per l’editing e l’anteprima):

- **protagonista**: piano animato rivolto verso la camera, con 4 frame di corsa, salto, scivolata e sparo (`src/game/player.js`);
- **nemici**: soldato, pattugliatore, drone e tank come billboard; le hitbox restano quelle dei modelli (`src/game/enemies.js`);
- **monete e power-up**: `InstancedMesh` con la texture dello sprite (`src/game/powerups.js`);
- **esplosioni**: `THREE.Sprite` che si gonfia e svanisce su uccisioni, casse e danni (`src/game/effects.js`);
- **boss**: `boss_sentinel_v2.webp`, generato con OpenAI `image_gen`, con alpha trasparente; originale PNG e prompt conservati in `assets/sprites/boss_sentinel_v2.png` e `assets/raw/boss_sentinel_v2.prompt.md`;
- **interfaccia**: icone di monete, arma, power-up e boss, avatar accanto alle vite, protagonista animato nel menu e nelle schermate di pausa e game over (`index.html`, `style.css`).

Il caricamento è in `src/game/sprites.js`: `loadSprites()` legge `atlas.json` e le texture prima di costruire la scena (al più `CONFIG.sprites.loadTimeout` secondi). Se un file manca o il caricamento fallisce, il modulo interessato torna al modello procedurale senza errori. In `CONFIG.sprites` si possono disattivare `hero`, `enemies`, `pickups` ed `explosions` singolarmente, oppure tutto con `enabled: false`; `heroAngle` ed `enemyAngle` regolano l’inclinazione dei billboard rispetto alla camera.

### Rigenerare gli sprite da un nuovo sheet

Lo sheet sorgente è `assets/raw/spritesheet.png`: una griglia 4×5 su sfondo verde chroma, con le celle nell’ordine riportato in `tools/slice_sprites.py` (`NAMES`). Per un nuovo sheet basta sostituire il file e lanciare:

```sh
make sprites            # python3 tools/slice_sprites.py (solo Pillow)
```

Lo script rileva la griglia (o la forza con `--cols/--rows`), rimuove il verde con una chroma key a “eccesso di verde” che conserva i verdi interni degli oggetti, smiscela il colore ai bordi, scarta i frammenti delle celle vicine e scrive PNG, WebP, le versioni da 128 px per l’HUD, `atlas.json` (dimensioni e ancoraggio) e `preview.png` per il controllo visivo.

## Struttura

- `index.html`, `style.css`: schermate responsive, HUD e controlli.
- `src/main.js`: renderer, resize, risoluzione adattiva e avvio.
- `src/game/game.js`, `loop.js`, `states.js`: orchestrazione e stato della partita.
- `input.js`, `player.js`: tastiera, touch, gamepad, movimento e animazione.
- `world.js`, `spawner.js`, `obstacles.js`: scenario e pattern.
- `enemies.js`, `weapons.js`, `boss.js`, `collisions.js`: combattimento.
- `powerups.js`, `storage.js`, `ui.js`: raccolta, salvataggi e interfaccia.
- `models.js`, `effects.js`, `audio.js`: geometrie ed effetti procedurali.
- `sprites.js`: registro e caricamento degli sprite 2D con fallback.
- `config.js`: bilanciamento e palette.
- `assets/raw/`, `assets/sprites/`: sheet sorgente e sprite ritagliati.
- `tools/slice_sprites.py`: ritaglio e chroma key dello sheet.
- `Dockerfile`, `nginx.conf`, `docker-compose.yml`, `Makefile`: distribuzione e comandi.
- `tests/`: test della logica e simulazione d’integrazione.

## Verifiche

Con Node.js 22 o successivo, senza `npm install`:

```sh
npm run check
npm test
```

`check` esegue `node --check` su tutti i moduli. I test di logica coprono le regole di corsia delle monete e del magnete, pattern e vie libere, tempi di cambio corsia, selezione pesata, hitbox salto/slide, collisioni spazzate dei proiettili e salvataggi corrotti/negati.

La simulazione d’integrazione usa **Three.js reale 0.169.0**, un DOM minimo e un renderer fittizio. Se possiedi una copia locale della libreria:

```sh
THREE_MODULE=/percorso/three/build/three.module.js node tests/simulation.mjs
```

Sono passate **19 verifiche d’integrazione**, incluse raccolta per corsia, pausa con scena immobile, premi salto/scivolata e pattugliamento interpolato: avvio, movimento, buffer, pausa, overheat e recupero, combattimento, combo, scudo, game over/retry, raccolta, boss, salvataggio singolo, corsa lunga con pool stabili, camera verticale, touch simulato e tre corse da 184 secondi con semi riproducibili e un controller automatico. Queste ultime conservano tutte e tre le vite **senza invulnerabilità artificiale**. La verifica separata di stabilità usa invece invulnerabilità per osservare l’intero ciclo. Sono stati osservati tre ambienti, due boss e nessuna crescita del numero di oggetti della scena.

Questi test verificano la logica e le trasformazioni, **non** il rendering WebGL, l’ascolto dell’audio, gli eventi touch reali o il frame rate.

## Stato dei lavori

- [x] **1.** Scheletro, loop fisso, corsie, salto, scivolata e camera. Controllo sintattico superato.
- [x] **2.** Mondo riciclato, pattern con via libera, ostacoli, collisioni e game over. Controllo sintattico superato.
- [x] **3.** Proiettili in pool, quattro tipi di nemico, casse distruttibili, raffica e calore. Controllo sintattico superato.
- [x] **4.** Monete in file/archi, quattro bonus, punteggio, combo e salvataggi protetti. Controllo sintattico superato.
- [x] **5.** Boss, tre ambientazioni e difficoltà progressiva. Controllo sintattico superato.
- [x] **6.** Web Audio, juice, UI, touch/gamepad, instancing e ottimizzazioni mobile. Controllo sintattico superato.
- [x] **7.** Rifinitura e playtest simulato: camera verticale, interpolazione, allineamento dello scenario, retry e salvataggi verificati; sei test di logica e 15 d’integrazione superati.
- [x] **8.** Sprite 2D: protagonista, nemici, monete, power-up, esplosioni e interfaccia, con fallback procedurale; `tools/slice_sprites.py`, Makefile, Docker.
- [x] **Verifica in browser (headless):** avvio, menu, corsa con tastiera, raffica e surriscaldamento, power-up, nemici, pausa e game over a 1440×900 e 390×844 con Chromium headless: console pulita, 36–63 draw call, 18 texture. Il frame rate in headless (rendering software) non è significativo.
- [ ] **Verifica su dispositivi reali:** ascolto audio, swipe e pulsante FUOCO su touch vero, misura fps su GPU reale e su smartphone.

### Limiti della verifica e bug noti

Nessun bug di logica noto nei casi coperti. Da verificare a mano: una corsa di almeno tre minuti in orizzontale su telefono, pausa al cambio scheda, audio/mute, persistenza dopo reload e frame rate durante una raffica tripla con boss.
