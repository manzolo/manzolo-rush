import { CONFIG } from './config.js';
export class Audio {
    // enabled = effetti sonori (spari, esplosioni…); musicOn = brani o musica procedurale.
    constructor(enabled = true, musicOn = true) {
        this.enabled = enabled; this.musicOn = musicOn; this.context = null; this.beat = 0; this.note = 0; this.active = false;
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
        const target = this.musicOn ? CONFIG.audio.trackVolume : 0, rate = dt / CONFIG.audio.fade;
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
                this.master.gain.value = this.enabled ? CONFIG.audio.master : 0;
                this.master.connect(this.context.destination);
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
            this.master.gain.setTargetAtTime(enabled ? CONFIG.audio.master : 0, this.context.currentTime, .03);
    }
    setMusic(on) {
        this.musicOn = on;
        this.unlock();
        this.music(this.wanted);
    }
    tone(frequency, duration, type = 'sine', volume = .15, endFrequency = frequency, delay = 0) {
        if (!this.context || !this.enabled || this.context.state !== 'running')
            return;
        const t = this.context.currentTime + delay, osc = this.context.createOscillator(), gain = this.context.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(frequency, t);
        osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFrequency), t + duration);
        gain.gain.setValueAtTime(.001, t);
        gain.gain.exponentialRampToValueAtTime(Math.max(.002, volume), t + .008);
        gain.gain.exponentialRampToValueAtTime(.001, t + duration);
        osc.connect(gain);
        gain.connect(this.master);
        osc.start(t);
        osc.stop(t + duration + .02);
        osc.onended = () => { osc.disconnect(); gain.disconnect(); };
    }
    burstNoise(duration = .18, volume = .45) {
        if (!this.context || !this.enabled)
            return;
        const t = this.context.currentTime, source = this.context.createBufferSource(), filter = this.context.createBiquadFilter(), gain = this.context.createGain();
        source.buffer = this.noise;
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(2200, t);
        filter.frequency.exponentialRampToValueAtTime(80, t + duration);
        gain.gain.setValueAtTime(volume, t);
        gain.gain.exponentialRampToValueAtTime(.001, t + duration);
        source.connect(filter);
        filter.connect(gain);
        gain.connect(this.master);
        source.start(t);
        source.stop(t + duration);
        source.onended = () => { source.disconnect(); filter.disconnect(); gain.disconnect(); };
    }
    play(name) {
        if (!this.enabled || !this.context)
            return;
        switch (name) {
            case 'shoot':
                // Colpo secco: "pew" in discesa + scoppio breve di rumore; limitato a ~30 al secondo.
                if (this.context.currentTime - (this.lastShot || 0) < .033)
                    return;
                this.lastShot = this.context.currentTime;
                this.tone(720, .09, 'square', .14, 140);
                this.tone(180, .06, 'triangle', .16, 60);
                this.burstNoise(.05, .22);
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
            case 'bossShot':
                this.tone(160, .18, 'sawtooth', .12, 45);
                break;
        }
    }
    update(dt, active) {
        this.active = active;
        // Con i brani MP3 la musica procedurale resta spenta.
        if (!active || !this.enabled || !this.musicOn || !this.context || this.hasTracks)
            return;
        this.beat -= dt;
        if (this.beat > 0)
            return;
        this.beat += 60 / CONFIG.audio.tempo / 2;
        const notes = [220, 330, 440, 330, 196, 294, 392, 294, 174.61, 261.63, 349.23, 261.63, 196, 294, 392, 523.25];
        this.tone(notes[this.note % notes.length], .18, 'triangle', CONFIG.audio.music);
        if (this.note % 4 === 0)
            this.tone(notes[this.note % notes.length] / 4, .35, 'sine', CONFIG.audio.music * 1.5);
        this.note++;
    }
}
