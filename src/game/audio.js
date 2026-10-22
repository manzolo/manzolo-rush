import { CONFIG } from './config.js';
import { volumeLevel } from './storage.js';
export class Audio {
    // enabled = effetti sonori (spari, esplosioni…); musicOn = brani o musica procedurale.
    constructor(enabled = true, musicOn = true, soundVolume = 1, musicVolume = 1) {
        this.enabled = enabled; this.musicOn = musicOn; this.context = null; this.beat = 0; this.note = 0; this.active = false;
        this.soundVolume = volumeLevel(soundVolume);
        this.musicVolume = volumeLevel(musicVolume);
        // Brani MP3: <audio> in loop con dissolvenza; il browser li fa partire solo dopo
        // il primo tocco o tasto, quindi il menu "aggancia" la musica alla prima interazione.
        this.tracks = {};
        this.track = null;
        this.wanted = null;
        if (typeof window.Audio === 'function')
            for (const [name, src] of Object.entries(CONFIG.audio.tracks || {})) {
                const el = new window.Audio(src);
                el.loop = true;
                el.preload = name === 'menu' ? 'auto' : 'metadata';
                el.volume = 0;
                el.addEventListener('error', () => { delete this.tracks[name]; });
                this.tracks[name] = el;
            }
        const first = () => { this.unlock(); this.music(this.wanted); };
        window.addEventListener('pointerdown', first, { once: true });
        window.addEventListener('keydown', first, { once: true });
        if (this.hasTracks)
            setInterval(() => this.fadeStep(.05), 50);
    }
    get hasTracks() { return Object.keys(this.tracks).length > 0; }
    // state: 'menu' | 'run' | 'pause' | null. In pausa il brano della corsa si ferma e riprende da lì.
    music(state) {
        this.wanted = state;
        const name = state === 'pause' ? null : state;
        if (name && this.tracks[name] && this.musicOn) {
            const el = this.tracks[name];
            if (name === 'run' && this.track !== 'run' && this.lastState !== 'pause')
                el.currentTime = 0;
            el.play().catch(() => { });
        }
        this.track = name;
        this.lastState = state;
    }
    fadeStep(dt) {
        const target = this.musicOn ? CONFIG.audio.trackVolume * this.musicVolume : 0, rate = dt / CONFIG.audio.fade;
        for (const [name, el] of Object.entries(this.tracks)) {
            const goal = name === this.track ? target : 0;
            el.volume = Math.max(0, Math.min(1, el.volume + Math.sign(goal - el.volume) * Math.min(rate, Math.abs(goal - el.volume))));
            if (el.volume === 0 && goal === 0 && !el.paused)
                el.pause();
        }
    }
    unlock() {
        if (!this.context) {
            const Constructor = window.AudioContext || window.webkitAudioContext;
            if (!Constructor)
                return;
            try {
                this.context = new Constructor();
                this.master = this.context.createGain();
                this.master.gain.value = this.enabled ? CONFIG.audio.master * this.soundVolume : 0;
                this.master.connect(this.context.destination);
                this.musicGain = this.context.createGain();
                this.musicGain.gain.value = this.musicOn ? CONFIG.audio.master * this.musicVolume : 0;
                this.musicGain.connect(this.context.destination);
                this.noise = this.context.createBuffer(1, this.context.sampleRate * .5, this.context.sampleRate);
                const data = this.noise.getChannelData(0);
                for (let i = 0; i < data.length; i++)
                    data[i] = Math.random() * 2 - 1;
            }
            catch {
                return;
            }
        }
        if (this.context.state === 'suspended')
            this.context.resume().catch(() => { });
    }
    setEnabled(enabled) {
        this.enabled = enabled;
        this.unlock();
        if (this.master)
            this.master.gain.setTargetAtTime(enabled ? CONFIG.audio.master * this.soundVolume : 0, this.context.currentTime, .03);
    }
    setMusic(on) {
        this.musicOn = on;
        this.unlock();
        if (this.musicGain)
            this.musicGain.gain.setTargetAtTime(on ? CONFIG.audio.master * this.musicVolume : 0, this.context.currentTime, .03);
        this.music(this.wanted);
    }
    setVolume(channel, value) {
        const music = channel === 'music';
        this[music ? 'musicVolume' : 'soundVolume'] = volumeLevel(value);
        if (music)
            this.setMusic(this.musicOn);
        else
            this.setEnabled(this.enabled);
    }
    tone(frequency, duration, type = 'sine', volume = .15, endFrequency = frequency, delay = 0, music = false) {
        if (!this.context || !(music ? this.musicOn : this.enabled) || this.context.state !== 'running')
            return;
        const t = this.context.currentTime + delay, osc = this.context.createOscillator(), gain = this.context.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(frequency, t);
        osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFrequency), t + duration);
        gain.gain.setValueAtTime(.001, t);
        gain.gain.exponentialRampToValueAtTime(Math.max(.002, volume), t + .008);
        gain.gain.exponentialRampToValueAtTime(.001, t + duration);
        osc.connect(gain);
        gain.connect(music ? this.musicGain : this.master);
        osc.start(t);
        osc.stop(t + duration + .02);
        osc.onended = () => { osc.disconnect(); gain.disconnect(); };
    }
    burstNoise(duration = .18, volume = .45) {
        this.noiseHit(duration, volume);
    }
    // Rumore filtrato: lo spettro del colpo (botto, sibilo, scatto metallico) viene dal filtro.
    noiseHit(duration, volume, { filter = 'lowpass', from = 2200, to = 80, q = 1, delay = 0, attack = 0 } = {}) {
        if (!this.context || !this.enabled)
            return;
        const t = this.context.currentTime + delay, source = this.context.createBufferSource(), node = this.context.createBiquadFilter(), gain = this.context.createGain();
        source.buffer = this.noise;
        source.playbackRate.value = .9 + Math.min(1, duration) * .2;
        node.type = filter;
        node.Q.value = q;
        node.frequency.setValueAtTime(from, t);
        node.frequency.exponentialRampToValueAtTime(Math.max(20, to), t + duration);
        gain.gain.setValueAtTime(attack ? .001 : volume, t);
        if (attack)
            gain.gain.exponentialRampToValueAtTime(volume, t + attack);
        gain.gain.exponentialRampToValueAtTime(.001, t + duration);
        source.connect(node);
        node.connect(gain);
        gain.connect(this.master);
        source.start(t, Math.random() * .2);
        source.stop(t + duration + .02);
        source.onended = () => { source.disconnect(); node.disconnect(); gain.disconnect(); };
    }
    // Ogni arma ha la sua firma: corpo (rumore filtrato), coda grave e un dettaglio meccanico.
    shot(kind) {
        const pitch = .94 + Math.random() * .12;
        switch (kind) {
            case 'scatter':
                // Fucile a pompa: botto pieno e basso, coda lunga, poi lo scatto della pompa.
                this.noiseHit(.32, .55, { from: 3200, to: 120 });
                this.tone(110 * pitch, .22, 'sine', .3, 38);
                this.noiseHit(.04, .2, { filter: 'highpass', from: 2400, to: 2400, delay: .2 });
                this.noiseHit(.05, .18, { filter: 'bandpass', from: 1500, to: 1100, q: 4, delay: .27 });
                break;
            case 'plasma':
                // Scarica di plasma: risucchio in salita e colpo sordo che vibra.
                this.tone(140 * pitch, .32, 'sawtooth', .14, 55);
                this.tone(70 * pitch, .3, 'sine', .25, 32);
                this.tone(900 * pitch, .16, 'sine', .07, 2600);
                this.noiseHit(.24, .2, { filter: 'bandpass', from: 600, to: 3000, q: 2.5 });
                break;
            case 'laser':
                // Raggio: zap acuto e breve con una frizione elettrica.
                this.tone(2600 * pitch, .07, 'sawtooth', .06, 900);
                this.tone(1300 * pitch, .08, 'square', .045, 420);
                this.noiseHit(.05, .08, { filter: 'highpass', from: 5000, to: 3000 });
                break;
            case 'rocket':
                // Lancio: colpo d'espulsione, poi il soffio del propellente che si allontana.
                this.noiseHit(.08, .4, { from: 1800, to: 200 });
                this.tone(75 * pitch, .2, 'sine', .3, 34);
                this.noiseHit(.6, .3, { filter: 'bandpass', from: 450, to: 2600, q: 1.4, attack: .06 });
                break;
            default:
                // Blaster: colpo energetico secco, con un corpo grave che dà peso.
                this.tone(1500 * pitch, .07, 'square', .07, 260);
                this.tone(170 * pitch, .07, 'triangle', .16, 55);
                this.noiseHit(.045, .22, { filter: 'bandpass', from: 2600, to: 900, q: 1.2 });
        }
    }
    play(name, variant) {
        if (!this.enabled || !this.context)
            return;
        switch (name) {
            case 'shoot':
                // Suono specifico dell'arma (variant); limitato a ~30 colpi al secondo.
                if (this.context.currentTime - (this.lastShot || 0) < .033)
                    return;
                this.lastShot = this.context.currentTime;
                this.shot(variant);
                break;
            case 'jump':
                this.tone(180, .16, 'sine', .13, 500);
                break;
            case 'land':
                this.tone(95, .07, 'triangle', .12, 40);
                break;
            case 'coin':
                if (this.context.currentTime - (this.lastCoin || 0) < .055)
                    return;
                this.lastCoin = this.context.currentTime;
                this.tone(1100, .08, 'sine', .13, 1600);
                break;
            case 'power':
                this.tone(440, .13, 'triangle', .2);
                this.tone(660, .13, 'triangle', .2, 660, .1);
                this.tone(880, .2, 'triangle', .2, 880, .2);
                break;
            case 'explosion':
                this.burstNoise(.3);
                this.tone(95, .25, 'sawtooth', .18, 25);
                break;
            case 'hit':
                this.burstNoise(.08);
                break;
            case 'hurt':
                this.tone(150, .25, 'sawtooth', .17, 45);
                break;
            case 'over':
                this.tone(330, .18, 'triangle', .2);
                this.tone(247, .2, 'triangle', .2, 247, .16);
                this.tone(165, .4, 'triangle', .2, 80, .34);
                break;
            case 'boss':
                this.tone(80, .5, 'sawtooth', .2, 110);
                break;
            case 'tick':
                // Tempo agli sgoccioli: tic di orologio; negli ultimi secondi doppio bip più acuto.
                this.noiseHit(.03, .25, { filter: 'highpass', from: 3500, to: 3000 });
                this.tone(variant ? 1500 : 1000, .07, 'square', variant ? .12 : .08, variant ? 1500 : 1000);
                if (variant)
                    this.tone(1500, .07, 'square', .12, 1500, .14);
                break;
            case 'timeup':
                // Tempo scaduto: sirena che cala.
                this.tone(880, .6, 'sawtooth', .18, 220);
                this.tone(440, .6, 'square', .1, 110, .05);
                break;
            case 'bossShot':
                this.tone(160, .18, 'sawtooth', .12, 45);
                break;
        }
    }
    update(dt, active) {
        this.active = active;
        // Con i brani MP3 la musica procedurale resta spenta.
        if (!active || !this.musicOn || !this.context || this.hasTracks)
            return;
        this.beat -= dt;
        if (this.beat > 0)
            return;
        this.beat += 60 / CONFIG.audio.tempo / 2;
        const notes = [220, 330, 440, 330, 196, 294, 392, 294, 174.61, 261.63, 349.23, 261.63, 196, 294, 392, 523.25];
        this.tone(notes[this.note % notes.length], .18, 'triangle', CONFIG.audio.music, notes[this.note % notes.length], 0, true);
        if (this.note % 4 === 0)
            this.tone(notes[this.note % notes.length] / 4, .35, 'sine', CONFIG.audio.music * 1.5, notes[this.note % notes.length] / 4, 0, true);
        this.note++;
    }
}
