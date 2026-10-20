import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

class Vector {
  constructor(x = 0, y = 0) { this.x = x; this.y = y; }
  set(x, y) { this.x = x; this.y = y; return this; }
  copy() { return new Vector(this.x, this.y); }
  magSq() { return this.x * this.x + this.y * this.y; }
  mag() { return Math.sqrt(this.magSq()); }
  normalize() { const m = this.mag(); if (m) { this.x /= m; this.y /= m; } return this; }
  mult(n) { this.x *= n; this.y *= n; return this; }
  static dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }
}

test('bonus et cachettes sont des Vehicle et leurs règles de contact/expiration sont cohérentes', () => {
  const context = vm.createContext({
    createVector: (x, y) => new Vector(x, y),
    p5: { Vector },
    random: value => Array.isArray(value) ? value[0] : value * 0.5,
    TWO_PI: Math.PI * 2,
    millis: () => 1000,
    constrain: (v, min, max) => Math.max(min, Math.min(max, v)),
    push() {}, pop() {}, translate() {}, noStroke() {}, fill() {}, circle() {},
    stroke() {}, strokeWeight() {}, noFill() {}, ellipse() {}, rect() {}, triangle() {},
    textAlign() {}, textSize() {}, text() {}, arc() {}, CENTER: 'center', PI: Math.PI,
  });
  for (const file of ['vehicle.js', 'powerUp.js', 'hideSpot.js']) {
    vm.runInContext(readFileSync(new URL(`../${file}`, import.meta.url), 'utf8'), context, { filename: file });
  }
  const { Vehicle, PowerUp, HideSpot } = vm.runInContext('({ Vehicle, PowerUp, HideSpot })', context);
  const bonus = new PowerUp(10, 20, 'speed', 100);
  const spot = new HideSpot(40, 50, 'bush');
  const player = new Vehicle(40, 50);
  player.r = 12;
  assert.ok(bonus instanceof Vehicle);
  assert.ok(spot instanceof Vehicle);
  assert.equal(bonus.isExpired(100 + PowerUp.LIFETIME_MS - 1), false);
  assert.equal(bonus.isExpired(100 + PowerUp.LIFETIME_MS), true);
  assert.equal(spot.contains(player), true);
  player.pos.set(180, 180);
  assert.equal(spot.contains(player), false);
  assert.deepEqual(Array.from(PowerUp.TYPES), ['speed', 'invisibility', 'shield', 'energy']);
});
