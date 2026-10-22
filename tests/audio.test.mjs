import test from 'node:test';
import assert from 'node:assert/strict';
import { Audio } from '../src/game/audio.js';
import { CONFIG } from '../src/game/config.js';

const gain = () => ({ value: 0, setTargetAtTime(value) { this.value = value; }, setValueAtTime() {}, exponentialRampToValueAtTime() {} });
class Context {
    constructor() { this.currentTime = 1; this.sampleRate = 100; this.state = 'running'; this.destination = {}; this.connections = []; }
    createGain() { return { gain: gain(), connect: target => this.connections.push(target), disconnect() {} }; }
    createBuffer() { return { getChannelData: () => new Float32Array(50) }; }
    createOscillator() { this.oscillators = (this.oscillators || 0) + 1; return { frequency: gain(), connect() {}, start() {}, stop() {} }; }
    createBufferSource() { this.sources = (this.sources || 0) + 1; return { playbackRate: gain(), connect() {}, start() {}, stop() {} }; }
    createBiquadFilter() { return { frequency: gain(), Q: gain(), connect() {}, disconnect() {} }; }
}
globalThis.window = { AudioContext: Context, addEventListener() {} };

test('volume effetti indipendente dalla musica, mute conserva il livello', () => {
    const audio = new Audio(true, true, .4, .6);
    audio.unlock();
    assert.equal(audio.master.gain.value, CONFIG.audio.master * .4);
    assert.equal(audio.musicGain.gain.value, CONFIG.audio.master * .6);
    audio.setEnabled(false);
    assert.equal(audio.master.gain.value, 0);
    assert.equal(audio.musicGain.gain.value, CONFIG.audio.master * .6);
    audio.setEnabled(true);
    assert.equal(audio.master.gain.value, CONFIG.audio.master * .4);
    audio.setVolume('sound', .2);
    audio.setVolume('music', .7);
    assert.equal(audio.master.gain.value, CONFIG.audio.master * .2);
    assert.equal(audio.musicGain.gain.value, CONFIG.audio.master * .7);
    audio.setMusic(false);
    assert.equal(audio.musicGain.gain.value, 0);
    assert.equal(audio.master.gain.value, CONFIG.audio.master * .2);
});

test('MP3: volume zero ferma la traccia e alzarlo la riavvia', () => {
    const audio = new Audio();
    const track = { volume: CONFIG.audio.trackVolume, paused: false, pause() { this.paused = true; }, play() { this.paused = false; return Promise.resolve(); } };
    audio.tracks = { menu: track };
    audio.music('menu');
    audio.setVolume('music', 0);
    audio.fadeStep(1);
    assert.equal(track.volume, 0);
    assert.ok(track.paused);
    audio.setVolume('music', .5);
    audio.fadeStep(1);
    assert.equal(track.volume, CONFIG.audio.trackVolume * .5);
    assert.ok(!track.paused);
    audio.setEnabled(false);
    audio.fadeStep(1);
    assert.equal(track.volume, CONFIG.audio.trackVolume * .5);
});

test('musica procedurale continua con gli effetti disattivati', () => {
    const audio = new Audio(false, true);
    audio.unlock();
    audio.update(.1, true);
    assert.equal(audio.note, 1);
    assert.ok(audio.context.connections.includes(audio.musicGain));
    audio.setMusic(false);
    audio.update(1, true);
    assert.equal(audio.note, 1);
});

test('ogni arma ha un suono di sparo distinto e limitato a ~30 al secondo', () => {
    const audio = new Audio();
    audio.unlock();
    const signatures = new Set();
    for (const kind of ['blaster', 'scatter', 'plasma', 'laser', 'rocket']) {
        audio.context.oscillators = audio.context.sources = 0;
        audio.context.currentTime += 1;
        audio.play('shoot', kind);
        signatures.add(`${audio.context.oscillators}/${audio.context.sources}`);
        assert.ok(audio.context.oscillators + audio.context.sources > 0, kind);
        const before = audio.context.oscillators + audio.context.sources;
        audio.play('shoot', kind);
        assert.equal(audio.context.oscillators + audio.context.sources, before, `${kind}: limite di frequenza`);
    }
    assert.ok(signatures.size >= 4);
});
