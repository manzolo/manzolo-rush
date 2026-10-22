# MANZOLO RUSH

Un endless runner 3D a tre corsie: corri, salta, scivola e spara attraverso sei ambienti: città, foresta con rovine, deserto, valle vulcanica, base neon e vette innevate. Il giochino di famiglia di Manzolo: i personaggi sono i membri della famiglia. Modelli 3D, texture ed effetti sonori sono procedurali; sprite e musica stanno in `assets/`. HTML5, CSS e moduli JavaScript ES, **senza build e senza installazione di dipendenze** per giocare.

Three.js **0.169.0**, fissato nell’importmap di `index.html`, è l’unica dipendenza runtime e viene caricato da jsDelivr. Serve una connessione al CDN; la disponibilità offline dipende dalla cache del browser. Gli altri file (sprite e musica) sono nel repository.

## Avvio

Dalla cartella del progetto:

```sh
python3 -m http.server 8000
```

Apri **http://localhost:8000** e premi **INIZIA LA CORSA**. In alternativa `npm run serve` o `make serve` avviano lo stesso server. Non aprire `index.html` con `file://`: i moduli richiedono HTTP.

### Makefile

`make` (o `make help`) elenca i target: `serve`, `check`, `test`, `verify`, `sprites`, `build`, `up`, `down`, `logs`, `run`, `clean`. Le variabili `PORT`, `DOCKER_PORT`, `IMAGE` e `TAG` si passano sulla riga di comando (`make serve PORT=9000`).

### Online

Si gioca da **https://manzolo.github.io/manzolo-rush/**. La pubblica l'action `.github/workflows/pages.yml`, **solo
quando arriva un tag** `v<versione>`: verifica che il tag coincida con `src/game/version.js`, lancia sintassi, test e
`check-public`, e carica solo i file del gioco. Un push su `main` senza tag non pubblica niente.

Il sito lo prepara `scripts/build-site.sh` (in locale: `make site`, risultato in `_site/`). Codice e stile finiscono in
una cartella con la versione (`0.2.1/src/…`, `0.2.1/style.css`) e le immagini prendono `?v=<versione>`, come sprite e
musica caricati dal codice (`versioned()` in `src/game/version.js`): a ogni versione cambiano gli URL e il browser non
riusa file vecchi dalla cache (Pages la tiene 10 minuti). Per chi ha ancora in cache la pagina precedente viene
pubblicata anche la versione prima, ricavata dal tag che precede quello corrente.

Nuova versione: `make bump` (oppure `make bump PARTE=minor` / `PARTE=major`). Alza la versione in `src/game/version.js`
e `package.json`, verifica, fa il commit «Versione x.y.z», crea il tag e lo spinge: l'action riparte da sola. La versione
si vede nel menu, sotto la scelta del personaggio.

### Su un server proprio

`make deploy` lancia i test, copia i file sul server, ricostruisce e riavvia il container dietro un reverse proxy
(`docker-compose.homeserver.yml`, rete esterna `nginx-net`). Host e indirizzo si scrivono in `deploy.local.mk`, che
resta fuori da git (`DEPLOY_HOST = root@mio-server`, `DEPLOY_URL = https://…`). Log: `make deploy-logs`.

### Docker

Il gioco è servito da nginx (`nginx:1.27-alpine`, configurazione in `nginx.conf` con MIME type per i moduli ES, gzip e cache degli asset):

```sh
make up        # docker compose up -d --build → http://localhost:8080
make logs      # segue i log
make down      # ferma e rimuove il container
```

Oppure senza compose: `make run` (immagine usa e getta su `DOCKER_PORT`). Three.js resta caricato dal CDN anche nel container.

Da smartphone, sulla stessa rete del computer, apri `http://IP-DEL-PC:8000` e consenti il traffico locale sulla porta 8000, se richiesto dal sistema. Sono supportati orientamento verticale e orizzontale. Serve un browser moderno con **WebGL 2**, importmap e Web Audio. L’audio si abilita dopo un’interazione. Musica: brani MP3 in `assets/audio/` (`intro.mp3` nel menu e a fine corsa, `run.mp3` durante la corsa, con dissolvenza); se mancano si usa la musica procedurale. In alto a destra ♫ accende/spegne la musica e 🔊 gli effetti sonori, separatamente; le preferenze restano salvate. Volumi in `CONFIG.audio` (`master` per gli effetti, `trackVolume` per i brani).

## Comandi

| Azione | Tastiera / mouse | Touch | Gamepad standard |
| --- | --- | --- | --- |
| Corsia (tenuto: continua a spostarsi) | ← / → oppure A / D | Swipe sinistra / destra (dito giù: continua) | Stick sinistro / D-pad |
| Salto | ↑ / W / Spazio | Swipe in alto | A |
| Scivolata | ↓ / S | Swipe in basso | B |
| Colpo / fuoco continuo | Ctrl, J o click sul mondo; tieni per continuare | Tocca FUOCO per attivare/disattivare | RT |
| Raffica | Tieni Shift o K | Tieni FUOCO oltre 280 ms | RB |
| Pausa / ripresa | P / Esc, oppure pulsante Ⅱ | Pulsante Ⅱ / CONTINUA | Usa UI |

La perdita di focus o visibilità mette automaticamente in pausa e rilascia gli input. Il fuoco automatico touch va riattivato alla ripresa. Swipe e pulsante possono essere usati con due dita contemporaneamente.

## Regole e progressione

- **Tempo**: la barra in alto al centro parte da 25 s e si consuma più o meno in fretta secondo la difficoltà (×0,7 Facile, ×1 Medio, ×1,3 Difficile). Ogni moneta ridà 0,5 s (fino a 30 s); a zero la corsa finisce con «TEMPO SCADUTO». Sotto i 6 s la barra diventa rossa e lampeggia. Durante boss e duelli il tempo è fermo (`CONFIG.timer`).
- **Tre vite**, più una vita extra ogni 5.000 punti fino a un massimo di 5 (`CONFIG.player.extraLifeEvery`, `maxLives`); sotto i cuori l’HUD mostra il prossimo traguardo. Ogni nemico abbattuto mostra i punti guadagnati (in oro quando c’è combo). Con Ctrl tenuto premuto meglio usare frecce e Spazio: Ctrl+W chiuderebbe la scheda del browser e non si può bloccare.
- 1,5 secondi di invulnerabilità dopo un danno: consentono di recuperare un errore mantenendo il ritmo. Lo scudo assorbe un colpo senza consumare una vita: è avvolto da filamenti di elettricità che scorrono sulla bolla (shader), ha un alone pulsante, scintille, un’onda all’attivazione e all’impatto e una pulsazione più rapida negli ultimi due secondi.
- Salto parabolico, cambio corsia in circa 150 ms e scivolata di 0,7 secondi. Salto e slide hanno un buffer di 180 ms prima dell’atterraggio/fine azione.
- La raffica riscalda il blaster: al 100% l’arma si blocca fino al 25%. Il fuoco normale è sostenibile.
- Nemici (`src/game/creatures.js`), animati con pose diverse per attesa, corsa, carica, colpo, danno e caduta: **demone** (dall’inizio, sputa palle di fuoco), **golem di ferro** (cambia corsia e carica, lancia mazze chiodate), **camaleonte** (si mimetizza: per un attimo restano solo gli occhi, non si può colpire e riappare in un’altra corsia, mai in quella di fuga), **demone alato** (vola e spara) e **golem di roccia** (resistente, con barra HP, fa rotolare macigni da saltare). I tipi più impegnativi si sbloccano gradualmente. Ogni nemico abbattuto, oltre ai punti, lascia la sua arma: demone → razzi, roccia → sparpagliatore, ferro → plasma, camaleonte → laser.
- Barriere da saltare, barre da oltrepassare in scivolata, treni da evitare e casse distruttibili che possono rilasciare bonus.
- Le monete si raccolgono solo nella corsia realmente occupata, anche durante i cambi. Il magnete raggiunge la stessa corsia e quelle immediatamente adiacenti, mai da un estremo all’altro.
- Le monete brillano: un riflesso le attraversa a turno e ogni tanto una stellina scintilla sul bordo. I punti (uccisioni, salti, scivolate, boss e duelli) compaiono con testo dorato a gradiente, rimbalzo e un’esplosione di raggi; più punti valgono, più la scritta è grande.
- Bonus di 11 secondi: fuoco triplo sulle corsie, scudo, magnete e punti ×2. Raccogliere nuovamente lo stesso bonus ne rinnova la durata.
- Punteggio: distanza + monete + uccisioni; +15 per una barriera saltata e +10 per una barra superata in scivolata, assegnati una sola volta al passaggio completo (anche questi premi valgono il doppio con ×2). Uccisioni entro 3 secondi aumentano la combo fino a ×8; il bonus ×2 si applica ai punti guadagnati durante la sua durata.
- Toccare un nemico avvia un **duello** contro quella creatura: nessun danno al contatto, strada e distanza ferme, arena libera e barra della vita dedicata. Il rivale cambia corsia a ogni salva: per colpirlo bisogna inseguirlo nella sua corsia. Le corsie illuminate anticipano i colpi: muri pieni mirati sulla tua corsia (su due corsie in Difficile), da evitare solo cambiando corsia, oppure a sorpresa una raffica alta o bassa su tutte e tre le corsie, da passare in scivolata o saltando (scritta SALTA/ABBASSATI). Le salve arrivano circa ogni 1,5 s, più spesso in Difficile. La vittoria vale quattro volte i punti base del nemico e rilascia uno scudo; poi la corsa riprende. I duelli non fanno avanzare il calendario dei boss.
- **Livelli senza limite**, con tre boss in rotazione (`src/game/bosses.js`): **Nuvola Tempesta → Golem di Magma → Golem di Ghiaccio → Nuvola Tempesta…**. Ogni vittoria aumenta il livello, ripristina il tempo e cambia la palette dello scenario. La vita dei boss cresce di 25 HP a ogni incontro (130, 155, 180, 205…); gli attacchi diventano gradualmente più frequenti e i proiettili più veloci, con limiti al ritmo e alla velocità e preavviso invariato (`CONFIG.boss.progression`). Il livello compare anche nella barra del boss.
- Durante boss e duelli lo scenario cambia stagione secondo il boss del livello: **autunno in tempesta** (cielo plumbeo, pioggia, lampi che illuminano la scena), **estate infuocata** (cielo rosso, lava e braci), **inverno** (cielo chiaro, neve, crepe di ghiaccio). Dopo la vittoria il tema normale ritorna gradualmente.
- Gli aiuti stanno nella parte alta dello schermo su desktop, tablet e telefono, separati dagli annunci e dalla barra del rivale. Il pulsante **?** in alto a destra li spegne o li riaccende (la scelta resta salvata); gli avvisi SALTA/ABBASSATI restano sempre.
- Allarme del tempo: sotto i 6 secondi un tic a ogni secondo, negli ultimi tre un doppio bip; a zero una sirena.
- Un boss ogni 90 secondi di gioco, alto 13–14 m, con pose per attesa, carica, colpo, soffio, danno e furia. Ogni salva ha due muri (fulmini o pioggia per la nuvola, spuntoni di lava, spuntoni di ghiaccio) che non si saltano e non si passano in scivolata e, nella terza corsia, un colpo basso da saltare (raffica di vento, onda di fuoco, cristalli) o uno alto sotto cui scivolare (fulmine, lancia di fuoco, schegge): durante il preavviso le corsie dei muri si colorano di rosso e quella di riparo di verde (salta) o azzurro (scivola). L'altezza si legge dal colpo stesso: quello basso striscia raso terra, alto quanto l'ostacolo, su una scia luminosa; quello alto vola in orizzontale all'altezza della testa, con lo spazio vuoto sotto. La corsia di riparo cambia a ogni salva e sotto il 40% di vita il boss spara più spesso (una salva ogni 1,85 s, poi ancora più ravvicinate). Il duello non ha limite di tempo: il boss resta finché non viene abbattuto. 
- Difficoltà selezionabile nel menu (verde, ambra, rosso) e salvata: **Facile** (15–30 m/s, un solo ostacolo per fila, tempo lento, nemici meno resistenti e duelli brevi), **Medio** (18,75–37,5 m/s, due ostacoli per fila e salve mirate), **Difficile** (22,5–45 m/s, tempo veloce, nemici più resistenti disponibili prima, salve dei duelli su due corsie). La scelta resta fissa durante la corsa; i moltiplicatori sono in `src/game/difficulty.js`. Le sei ambientazioni cambiano ogni 45 secondi: **Sunset City → Foresta delle Rovine → Dust Valley → Valle Vulcanica → Neon Outpost → Vette Innevate**, poi il giro ricomincia. Ogni ambiente ha texture, decorazioni, geometrie, nebbia e illuminazione proprie (`src/game/scenery.js`).
- Tenendo premuto sinistra o destra il personaggio continua a cambiare corsia, una ogni 0,45 s (`STEER_REPEAT` in `src/game/input.js`); il primo spostamento è immediato.
- Il pannello volume in alto a destra regola separatamente musica ed effetti (0–100%); i pulsanti rapidi permettono di silenziarli. Le impostazioni restano salvate. La versione compare in basso a destra.
- Il record mostra il personaggio e la difficoltà della corsa che lo ha stabilito. Cambiare selezione o pareggiare il punteggio non cambia l’autore. I vecchi record restano validi e indicano «Personaggio non registrato» finché non vengono superati.
- Record, personaggio, difficoltà, monete totali e audio sono salvati nella chiave `manzolo-rush-save` di localStorage (un salvataggio della vecchia chiave `neon-rush-save` viene letto e migrato automaticamente). I punti e le monete si registrano a fine corsa o tornando al menu. Storage indisponibile, pieno o corrotto non impedisce di giocare.

## Armi raccoglibili

Oltre al blaster, sulla strada (anello colorato a terra) e dentro le casse si trovano quattro armi a tempo (`CONFIG.guns.duration`, 14 s):

| Arma | Colpo | Danno | Particolarità |
| --- | --- | --- | --- |
| Sparpagliatore | 5 pallini a ventaglio | 1 ciascuno | corto raggio, copre la corsia |
| Plasma | sfera grande e lenta | 3 | trapassa 2 bersagli |
| Laser | raggio sottile e velocissimo | 2 | cadenza alta, trapassa 3 bersagli |
| Razzi | razzo lento | 6 | esplosione ad area (3,2 m) |

Raffica, surriscaldamento e fuoco triplo valgono per tutte. Nessuna arma perfora treni, barriere o boss. Ogni sparo ha vampa conica, alone e scintille alla bocca dell’arma; i colpi lasciano una scia luminosa del loro colore e i razzi uno scarico di fiamme. Anche il suono cambia con l’arma (Web Audio, `src/game/audio.js`): colpo energetico secco per il blaster, botto pieno con lo scatto della pompa per lo sparpagliatore, scarica vibrante per il plasma, zap acuto per il laser, espulsione e soffio del propellente per i razzi. Tutti i parametri sono in `CONFIG.guns` (`src/game/config.js`). Lo sheet grafico opzionale delle armi è descritto in `PROMPT_SPRITES.md` (sezione 4): finché manca si usa il blaster tinto del colore dell’arma.

## Generazione e prestazioni

I pattern scritti a mano occupano al massimo due corsie e conservano una corsia di fuga. La via libera si sposta al massimo di una corsia tra righe successive. L’intervallo minimo lascia margine per lo spostamento e il passaggio di un treno. I pattugliatori non attraversano la corsia riservata e smettono di cambiare corsia vicino al giocatore. Durante il boss il percorso viene liberato, evitando combinazioni tra ostacoli e salve.

La logica usa un timestep fisso di 1/60 s e il rendering interpola posizioni. Nove chunk riciclati, pool fissi per entità e proiettili, monete e particelle con `InstancedMesh`, dieci batch instanziati per lo scenario base e due visibili per le sagome degli ambienti naturali, materiali condivisi, ombra a texture canvas senza shadow map. Props raggruppati per texture e interpolati insieme alla strada. Pixel ratio massimo 2 con budget iniziale di 2 milioni di pixel; una media sotto 55 fps per 1,5 secondi riduce progressivamente la risoluzione fino a DPR 0,7. I cambi di risoluzione ridisegnano subito il canvas per evitare fotogrammi vuoti. In pausa camera, luci e trasformazioni rimangono congelate; il pannello non applica blur al canvas WebGL. L’interfaccia numerica si aggiorna circa 12 volte al secondo.

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

Oltre ai modelli procedurali, il gioco usa gli sprite in **`assets/sprites/`** (WebP con trasparenza; i PNG affiancati servono per l’editing e l’anteprima):

- **protagonista**: piano animato rivolto verso la camera, con 4 frame di corsa, salto, scivolata e sparo (`src/game/player.js`);
- **nemici**: demone, golem di ferro, camaleonte, demone alato e golem di roccia come billboard animati a fotogrammi, con colpi a sprite; senza sprite si torna ai robot o ai modelli procedurali; le hitbox restano quelle dei modelli (`src/game/enemies.js`, `src/game/creatures.js`);
- **boss**: nuvola, magma e ghiaccio con muri e barre a sprite (`src/game/boss.js`, `src/game/bosses.js`); la Sentinella resta come ripiego;
- **monete e power-up**: `InstancedMesh` con la texture dello sprite (`src/game/powerups.js`);
- **esplosioni**: `THREE.Sprite` che si gonfia e svanisce su uccisioni, casse e danni (`src/game/effects.js`);
- **boss**: `boss_sentinel_v2.webp`, generato con OpenAI `image_gen`, con alpha trasparente; originale PNG in `assets/sprites/boss_sentinel_v2.png`;
- **ambienti naturali**: 12 texture e 12 decorazioni per foresta, vulcano e neve, generate con lo strumento integrato OpenAI `image_gen`; WebP, PNG e versioni ridotte in `assets/sprites/`. Alberi, colonne basaltiche e montagne con cime innevate usano anche geometrie instanziate (`src/game/landscape.js`). I props rimangono fuori strada; se manca una texture, il ripiego riguarda solo il suo ambiente;
- **facciate di Sunset City**: disegnate su canvas in stile vettoriale (`src/game/facades.js`, `CONFIG.sprites.vectorCity`), intonate al tramonto e senza download;
- **interfaccia**: icone di monete, arma, power-up e boss, avatar accanto alle vite, protagonista animato nel menu e nelle schermate di pausa e game over (`index.html`, `style.css`).

Il caricamento è in `src/game/sprites.js`: `loadSprites()` legge `atlas.json` e le texture prima di costruire la scena (al più `CONFIG.sprites.loadTimeout` secondi). Se un file manca o il caricamento fallisce, il modulo interessato torna al modello procedurale senza errori. In `CONFIG.sprites` si possono disattivare `hero`, `enemies`, `pickups` ed `explosions` singolarmente, oppure tutto con `enabled: false`; `heroAngle` ed `enemyAngle` regolano l’inclinazione dei billboard rispetto alla camera.

### Rigenerare gli sprite da un nuovo sheet

Lo sheet sorgente è `assets/raw/spritesheet.png`: una griglia 4×5 su sfondo verde chroma, con le celle nell’ordine riportato in `tools/slice_sprites.py` (`NAMES`). Per un nuovo sheet basta sostituire il file e lanciare:

```sh
make sprites            # python3 tools/slice_sprites.py (solo Pillow)
```

I due sheet degli ambienti naturali si ritagliano con `make scenery-sprites`: `sheet_nature_textures.png` e `sheet_nature_props_v2.png`, entrambi in `assets/raw/`, griglia esatta 4×3. `--fixed-grid` evita il rilevamento cromatico; `--alpha` conserva la trasparenza originale dei props. I prompt finali sono conservati localmente in `prompts/scenery_nature.md`; fogli grezzi e prompt restano esclusi dalla distribuzione pubblica.

Gli sheet di nemici e boss (`demon`, `rock`, `iron`, `chameleon`, `storm`, `magma`, `ice` in `SHEETS`) hanno righe con celle di larghezza diversa: si tagliano con `--row-cols`, che segue le sottili linee di separazione verde scuro, ad esempio `python3 tools/slice_sprites.py --sheet assets/raw/sheet_demon.png --names demon --row-cols 7,6,6,6,6 --despill` (`--despill` solo se il soggetto non contiene verde, quindi non per il camaleonte).

Lo script rileva la griglia (o la forza con `--cols/--rows`), rimuove il verde con una chroma key a “eccesso di verde” che conserva i verdi interni degli oggetti, smiscela il colore ai bordi, scarta i frammenti delle celle vicine e scrive PNG, WebP, le versioni da 128 px per l’HUD, `atlas.json` (dimensioni e ancoraggio) e `preview.png` per il controllo visivo.

## Struttura

- `index.html`, `style.css`: schermate responsive, HUD e controlli.
- `src/main.js`: renderer, resize, risoluzione adattiva e avvio.
- `src/game/game.js`, `loop.js`, `states.js`: orchestrazione e stato della partita.
- `input.js`, `player.js`: tastiera, touch, gamepad, movimento e animazione.
- `world.js`, `scenery.js`, `landscape.js`, `spawner.js`, `obstacles.js`: ambienti, paesaggio e pattern.
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

`check` esegue `node --check` su tutti i moduli. I test di logica coprono le regole di corsia delle monete e del magnete, pattern e vie libere, tempi di cambio corsia, selezione pesata, hitbox salto/slide, collisioni spazzate dei proiettili e salvataggi corrotti/negati. Verificano anche migrazione dei vecchi record, persistenza di volumi e livelli, indipendenza tra musica ed effetti e fattibilità dei cambi corsia nelle tre difficoltà.

La simulazione d’integrazione usa **Three.js reale 0.169.0**, un DOM minimo e un renderer fittizio. Se possiedi una copia locale della libreria:

```sh
THREE_MODULE=/percorso/three/build/three.module.js node tests/simulation.mjs
```

Sono passate **41 verifiche d’integrazione**, incluse raccolta per corsia, pausa con scena immobile, premi salto/scivolata e pattugliamento interpolato: avvio, movimento, buffer, pausa, overheat e recupero, combattimento, combo, scudo, game over/retry, raccolta, boss, salvataggio singolo, corsa lunga con pool stabili, camera verticale, touch simulato e nove corse da 184 secondi (tre semi per ciascuna difficoltà) con un controller automatico. Sono coperti anche bagliore e reset dello scudo, attribuzione del record, densità degli ostacoli, avvio e ripristino dei duelli, rivale in movimento con raffiche alte, basse e muri mirati, atmosfera infernale, elettricità dello scudo, vampe e scia dei razzi. Quindici duelli (cinque creature per tre difficoltà) vengono vinti da un controller che schiva, salta, scivola e insegue il rivale senza invulnerabilità artificiale. Il controller delle nove corse raccoglie le monete per tenere il tempo, oltre a schivare; le corse conservano tutte e tre le vite **senza invulnerabilità artificiale**. La verifica separata di stabilità usa invece invulnerabilità per osservare l’intero ciclo. Sono stati osservati cinque ambienti nei primi tre minuti, due boss e nessuna crescita del numero di oggetti della scena. Verifiche dedicate coprono inoltre due giri dei sei scenari, dieci boss consecutivi, incremento della potenza, ripartenza dal livello 1 e ripiego degli asset mancanti. Un controllo WebGL in Chromium verifica tutti e sei gli ambienti a 1100×760 e 390×844, senza asset mancanti o errori di rendering; non misura le prestazioni di un telefono reale.

La simulazione senza GPU verifica logica e trasformazioni; il controllo browser separato verifica il rendering WebGL. Restano da verificare su dispositivo reale audio, touch e frame rate.

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

## Crediti e diritti

- **Codice**: scritto con l'aiuto di Codex (OpenAI) e Claude Code (Anthropic), su indicazioni di Andrea; licenza MIT (`LICENSE`).
- **Personaggi**: Manzolo, Erika, Mariel, Vittoria e Linda sono persone vere. Gli sprite sono generati con ChatGPT
  (generazione di immagini di OpenAI) a partire dalle loro foto, e sono pubblicati col loro consenso (per i minori, quello dei genitori).
  **Non sono coperti dalla licenza MIT**: non si riusano fuori da questo gioco.
- **Altri sprite** (nemici, boss, oggetti, texture): generati con ChatGPT (generazione di immagini di OpenAI).
- **Musica**: «Corsa alla Vittoria» (`assets/audio/`), creata con [Suno](https://suno.com) con un abbonamento a pagamento.
- **Three.js** 0.169.0, licenza MIT, caricato da jsDelivr.

Tutto quello che sta in `assets/` è © Andrea Manzi, tutti i diritti riservati.
