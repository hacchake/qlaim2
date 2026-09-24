// ランダム操作のファズテスト(開発用。時間がかかるので run-tests とは別)
//   node test/fuzz.js   … 9種の盤面で数万フレーム、例外と占領数の整合・自機の位置を確かめる
const fs = require('fs');
const root = require('path').join(__dirname, '..');
const h = fs.readFileSync(root + '/index.html', 'utf8');
const m = h.match(/<script>([\s\S]*?)<\/script>/);
const body = String.raw`
settings.tutor = true;
const DIRS = ['up','down','left','right'];
const NL = String.fromCharCode(10);
let problems = [], frames = 0;
function countOpen(){ let n=0; for (let i=0;i<surf.N;i++) if (grid[i]===OPEN) n++; return n; }
for (const md of (globalThis.FUZZ_MODES || ['VS','VS','PLANE','CUBE','SPHERE','GSD','KLEIN','MOBIUS','KNOT','TORUS','TRUNC_ICOSA'])) {
  settings.mode = md;
  for (let game = 0; game < 2; game++) {
    startGame(); stTimer = 2; tickMeta(0.016);
    if (game === 1) { level = 1 + ((Math.random() * 12) | 0); initLevel(level); setState('play'); }   // 2回目は途中のエリアから(buddyや突進も試す)
    let d = null;
    for (let f = 0; f < 2500; f++) {
      frames++;
      if (f % 20 === 0) {
        for (const k of DIRS) releaseDir(k);
        d = DIRS[(Math.random()*4)|0]; pressDir(d); held.fast = Math.random() < 0.4;
        if (Math.random() < 0.35) pressDir(d === 'up' || d === 'down' ? (Math.random() < 0.5 ? 'left' : 'right') : (Math.random() < 0.5 ? 'up' : 'down'));   // 斜め
        const an = Math.random() * 6.283; stickVec = Math.random() < 0.3 ? [Math.cos(an), Math.sin(an)] : null;          // アナログ
      }
      try {
        tickMeta(1/60); blinkT += 1/60; stTimer += 1/60;
        if (state === 'play') update(1/60);
        else if (state === 'clear' && stTimer > 1) nextLevel();
        else if (state === 'ready' && stTimer > 2) setState('play');
        else if (state === 'entry') entryNext();
        else if (state === 'vslose' && stTimer > 1) vsRetry();
        else if (state === 'over') { if (stTimer > 1) break; }
        if (f % 97 === 0) render();
      } catch (e) { problems.push(md + ' f' + f + ' ' + e.stack.split(NL).slice(0,4).join(' | ')); break; }
      if (state === 'play' && claimed !== initOpen - countOpen() - trail.length - rivalTrailCells()) {
        problems.push(md + ' 整合 claimed=' + claimed + ' vs ' + (initOpen - countOpen() - trail.length - rivalTrailCells()) + ' lv' + level); break;
      }
      if (state === 'play' && !player.drawing && !isBoundary(player.c) && deathTimer <= 0) { problems.push(md + ' 自機が線の外 lv' + level + ' c=' + player.c + ' prev=' + player.prev); break; }
    }
    for (const k of DIRS) releaseDir(k); stickVec = null;
  }
}
console.log('frames', frames, 'problems', problems.length);
console.log(problems.slice(0, 12).join(NL));
`;
eval(fs.readFileSync(root + '/test/shim.js', 'utf8') + m[1] + body);
