
// ================= ヘッドレス検証 =================
let fails = 0;
function assert(name, cond, info) {
  if (cond) console.log('OK  ' + name + (info !== undefined ? '  [' + info + ']' : ''));
  else { console.log('NG  ' + name + '  [' + info + ']'); fails++; }
}
const DNAME = { '0,-1':'up', '1,0':'right', '0,1':'down', '-1,0':'left' };
function steps(dx, dy, n) { const d = DNAME[dx + ',' + dy]; let c = 0; for (let i = 0; i < n; i++) { if (!playerMove(d)) break; c++; } return c; }
const openAt = q => grid[surf.qixCell(q)] === OPEN;
const pxy = () => (player.c % GW) + ',' + ((player.c / GW) | 0);
const nbs = c => Array.from(surf.nb.slice(c * 4, c * 4 + 4));
function countCells(v) { let n = 0; for (let i = 0; i < surf.N; i++) if (grid[i] === v) n++; return n; }

buddiesOn = false;   // ほかの検証の邪魔をしないよう buddy は後で個別に確かめる
settings.mode = 'PLANE'; initLevel(1);

// ---- 1) 初期状態 ----
assert('初期位置が境界上', isBoundary(player.c), pxy());
assert('初期占領率0%', percent() === 0);

// ---- 2) 壁沿い移動 ----
let m = steps(-1, 0, 10);
assert('壁沿いに10歩移動', m === 10, m);

// ---- 3) 描画→停止→導火線→ミス ----
held.fast = false;
m = steps(0, -1, 1);
assert('方向キーだけで空き地へ進むと遅い線(×2)を引き始める', m === 1 && player.drawing && !player.usedFast);
held.fast = true;
m = steps(0, -1, 29);
assert('Zを押すと速い線(×1)になる', m === 29 && trail.length === 30 && player.usedFast, m + '/' + trail.length);
for (let i = 0; i < 120 && deathTimer <= 0; i++) updateFuse(1/30, false);
assert('導火線点火', fuse.lit);
assert('導火線でミス発生', deathTimer > 0, deathTimer.toFixed(2));
applyDeath();
assert('軌跡が消えている', countCells(TRAIL) === 0 && !player.drawing);
assert('残機が減少', lives === settings.lives - 1, lives);
assert('描画開始地点に復帰', player.c === trailStart, pxy());

// ---- 4) 囲んで占領 ----
player.invuln = 0; held.fast = true;
const beforeClaimed = claimed;
steps(0, -1, 20); steps(-1, 0, 15);
m = steps(0, 1, 25);
assert('軌跡が閉じた', !player.drawing, 'down歩数=' + m);
assert('占領が発生', claimed > beforeClaimed, 'claimed=' + claimed + ' (' + percent().toFixed(2) + '%)');
assert('TRAILセル残存なし', countCells(TRAIL) === 0);
assert('占領数の整合', claimed === initOpen - countCells(OPEN), claimed + ' vs ' + (initOpen - countCells(OPEN)));
assert('QIXは空き地に居る', qixes.every(openAt));
assert('占領後も境界上', isBoundary(player.c), pxy());

// ---- 5) SPARX巡回 ----
for (let i = 0; i < 300; i++) sparxes.forEach(stepSparx);
assert('SPARXが境界上を巡回', sparxes.every(s => isBoundary(s.c)), sparxes.map(s => s.c).join(' / '));

// ---- 6) QIX移動(壁抜けなし) ----
for (let i = 0; i < 600; i++) updateQixes(1/60);
assert('QIXが空き地に留まる', qixes.every(openAt),
       qixes.map(q => q.x.toFixed(1) + ',' + q.y.toFixed(1)).join(' / '));

// ---- 7) 75%クリア ----
claimed = Math.ceil(initOpen * 0.76);
startClear(false);
assert('75%でクリア遷移', state === 'clear' && !wasSplit, 'bonus=' + lastBonus);

// ---- 8) 設定保存フォールバック ----
store.set('t.x', 5);
assert('storeフォールバック', store.get('t.x', 0) === 5);

// ---- 9) 音名→周波数 ----
assert('hz(A4)=440', Math.abs(hz('A4') - 440) < 0.01, hz('A4').toFixed(2));
assert('hz(C4)≈261.63', Math.abs(hz('C4') - 261.63) < 0.05, hz('C4').toFixed(2));
assert('hz(G#3)≈207.65', Math.abs(hz('G#3') - 207.65) < 0.05, hz('G#3').toFixed(2));
const badNotes = [];
for (const k in BGMDATA) for (const tr of BGMDATA[k].tracks) if (tr.s)
  for (const nm of tr.s) if (nm && !/^([A-G])(#?)(-?\d)$/.test(nm)) badNotes.push(k + ':' + nm);
assert('BGM譜面の音名がすべて正しい', badNotes.length === 0, badNotes.join(','));
assert('orbitの各トラック長=len', BGMDATA.orbit.tracks.every(t => !t.s || t.s.length === BGMDATA.orbit.len));

// ---- 10) テーマ切替 ----
let wallsBefore = countCells(WALL);
settings.theme = 2; applyTheme();
let wallsAfter = countCells(WALL);
assert('テーマ切替でグリッド不変', wallsBefore === wallsAfter && themePal.length === 8,
       wallsBefore + '/' + themePal.length);
assert('立体用の色表が揃う', col3D.length === NCOL * LV && col3D.every(c => /^rgb\(\d+,\d+,\d+\)$/.test(c)), col3D.length);
settings.theme = 0; applyTheme();

// ---- 11) OPTIONS操作 ----
optSel = OPT_ITEMS.findIndex(o => o.k === 'diff');
settings.diff = 'NORMAL';
adjustOpt(1);
assert('難易度がHARDへ巡回', settings.diff === 'HARD', settings.diff);
const fuseHard = effFuseDelay();
settings.diff = 'NORMAL';
const fuseNorm = effFuseDelay();
assert('HARDは導火線猶予が短い', fuseHard < fuseNorm, fuseHard + ' < ' + fuseNorm);
optSel = 0; settings.bgm = 6; adjustOpt(1);
assert('BGM音量+1', settings.bgm === 7, settings.bgm);

// ---- 12) BGM(AudioContext無しでも安全) ----
Bgm.play('play');
assert('BGMはAC無しなら予約のみ', Bgm.want === 'play' && !Bgm.playing);

// ---- 13) READYフロー ----
startGame();
assert('startGameでready状態', state === 'ready' && level === 1 && surf.key === 'PLANE');
stTimer = 2; tickMeta(0.016);
assert('READY経過でplayへ', state === 'play');

// ---- 14) AREA3: QIX2体・同一領域なら通常占領 ----
initLevel(3);
assert('AREA3でQIX2体', qixes.length === 2);
setState('play');
qixes[0].x = 40; qixes[0].y = 30; qixes[1].x = 88; qixes[1].y = 30;
player.c = idx(GW >> 1, GH - 1); player.drawing = false; player.invuln = 0; trail = [];
held.fast = true;
steps(0, -1, 10); steps(1, 0, 8); steps(0, 1, 12);
assert('2QIX同領域→通常閉鎖', !player.drawing && !wasSplit && state === 'play',
       'pct=' + percent().toFixed(2));
assert('両QIXとも空き地', qixes.every(openAt));

// ---- 15) QIX分断 → 即クリア ----
initLevel(3); setState('play');
qixes[0].x = 20; qixes[0].y = 80; qixes[1].x = 108; qixes[1].y = 80;
player.c = idx(GW >> 1, GH - 1); player.invuln = 0;
held.fast = true;
m = steps(0, -1, 200);
assert('縦断ラインで閉鎖', m === GH - 1, m);
assert('分断で即クリア', state === 'clear' && wasSplit, 'pct=' + percent().toFixed(1));
assert('圧殺されたQIXが除去', qixes.length === 1);
assert('SPLITボーナス加算', lastBonus >= CONFIG.SPLIT_BONUS, lastBonus);

// ---- 16) TOURモードの盤面の巡回 ----
settings.mode = 'TOUR';
assert('TOUR: 平面→立方体→球…→一巡して平面', ['PLANE','CUBE','SPHERE'].every((k, i) => surfaceFor(i + 1) === k)
       && surfaceFor(CONFIG.TOUR.length + 1) === 'PLANE', CONFIG.TOUR.length);
assert('TOURは全盤面を含む', Object.keys(CONFIG.SURF).every(k => CONFIG.TOUR.includes(k)));
settings.mode = 'CUBE';
assert('単独モードは常に同じ盤面', surfaceFor(1) === 'CUBE' && surfaceFor(5) === 'CUBE');

// ---- 17) 立方体・球のつながり(グラフ)が正しい ----
for (const key of ['CUBE', 'SPHERE']) {
  const S = getSurface(key), n = S.n;
  const nbOf = c => Array.from(S.nb.slice(c * 4, c * 4 + 4));
  let bad = 0, asym = 0;
  for (let c = 0; c < S.N; c++) {
    const ns = nbOf(c);
    if (new Set(ns).size !== 4 || ns.some(b => b < 0 || b === c)) bad++;
    for (const b of ns) if (!nbOf(b).includes(c)) asym++;
  }
  assert(key + ': 全セルに異なる4近傍', bad === 0, 'N=' + S.N + ' bad=' + bad);
  assert(key + ': 隣り合いが対称', asym === 0, asym);
  // 直進を 4n 歩続けるとぐるっと一周して元に戻る(面の継ぎ目で向きが崩れないこと)
  let loops = 0;
  for (const start of [0, 5 * n * n + 3 * n + 7, 3 * n * n - 1]) for (let k0 = 0; k0 < 4; k0++) {
    let prev = start, c = S.nb[start * 4 + k0];
    for (let s = 1; s < 4 * n; s++) {
      const kp = nbOf(c).indexOf(prev);
      prev = c; c = S.nb[c * 4 + ((kp + 2) & 3)];
    }
    if (c === start) loops++;
  }
  assert(key + ': 直進4n歩で一周して戻る', loops === 12, loops + '/12');
  let d8 = 0;
  for (let c = 0; c < S.N; c++) { let k = 0; for (let j = 0; j < 8; j++) if (S.nb8[c * 8 + j] >= 0) k++; if (k < 7 || k > 8) d8++; }
  assert(key + ': 斜め込み近傍は7〜8個', d8 === 0, d8);
  let back = 0;
  for (let c = 0; c < S.N; c++) if (S.cellAt(S.dir[c * 3], S.dir[c * 3 + 1], S.dir[c * 3 + 2]) !== c) back++;
  assert(key + ': 方向→セルの逆引きが一致', back === 0, back);
}

// ---- 18) 球: 初期陣地・QIX・SPARX ----
settings.mode = 'SPHERE'; startGame(); stTimer = 2; tickMeta(0.016);
assert('球でplay開始', state === 'play' && surf.key === 'SPHERE' && surf.is3D);
assert('球: 初期位置がHOMEの縁', isBoundary(player.c) && grid[player.c] === WALL);
assert('球: 初期占領率0% / 空きセル整合', percent() === 0 && initOpen === countCells(OPEN), initOpen + '/' + surf.N);
assert('球: QIXは空き地から', qixes.every(openAt));
for (let i = 0; i < 900; i++) updateQixes(1/60);
assert('球: QIXが空き地に留まる', qixes.every(openAt));
for (let i = 0; i < 300; i++) sparxes.forEach(stepSparx);
assert('球: SPARXがHOMEの縁を巡回', sparxes.every(s => isBoundary(s.c)));

// ---- 18b) 立体面のSPARXは出現待ちの間は動かず当たらない ----
{
  startGame(); stTimer = 2; tickMeta(0.016);
  const s0 = sparxes[0], c0 = s0.c;
  assert('球: 開始時SPARXは1体・出現待ちあり', sparxes.length === 1 && s0.wait > 0, s0.wait);
  player.c = c0; player.invuln = 0;
  updateSparxes(0.5);
  assert('球: 出現待ち中は動かず当たらない', s0.c === c0 && deathTimer <= 0);
  for (let i = 0; i < 400; i++) updateSparxes(1/60);
  assert('球: 待ち時間後は動き出す', s0.wait <= 0 && (s0.c !== c0 || deathTimer > 0));
  deathTimer = 0; lives = settings.lives;
  startGame(); stTimer = 2; tickMeta(0.016);
}

// ---- 19) 球: カメラが自機を正面に捉え、画面の向きで移動を選ぶ ----
{
  const p = surf.screenOf(player.c);
  assert('球: 自機が画面中央付近', Math.abs(p.x - cam.cx) < 20 && Math.abs(p.y - cam.cy) < 60,
         p.x.toFixed(0) + ',' + p.y.toFixed(0));
  held.fast = false;
  const r = chooseMove('right'), l = chooseMove('left');
  const pr = surf.screenOf(r), pl = surf.screenOf(l);
  assert('球: →で右隣、←で左隣の線へ', r >= 0 && l >= 0 && pr.x > p.x && pl.x < p.x,
         pr.x.toFixed(0) + ' / ' + pl.x.toFixed(0));
  const dn = chooseMove('down');
  assert('球: 方向キーだけで空き地へ出られる', dn >= 0 && grid[dn] === OPEN, dn);
}

// ---- 20) 球: 線を引いて囲む(HOMEの下に四角く張り出す) ----
{
  player.invuln = 0; held.fast = true;
  const c0 = claimed;
  const a = steps(0, 1, 5);          // 下(HOME から離れる向き)
  const b = steps(1, 0, 3);          // 右
  for (let i = 0; i < 20 && player.drawing; i++) playerMove('up');
  assert('球: 画面の向きで描画できる', a === 5 && b === 3, a + '/' + b);
  assert('球: 囲んで閉じた', !player.drawing && countCells(TRAIL) === 0);
  assert('球: 占領が発生', claimed > c0, 'claimed=' + claimed + ' (' + percent().toFixed(2) + '%)');
  assert('球: 占領数の整合', claimed === initOpen - countCells(OPEN));
  assert('球: 占領後も境界上', isBoundary(player.c));
  assert('球: QIXは空き地に居る', qixes.every(openAt));
}

// ---- 21) 立方体: 面の継ぎ目をまたいで線を引ける ----
settings.mode = 'CUBE'; startGame(); stTimer = 2; tickMeta(0.016);
{
  held.fast = true; player.invuln = 0;
  const n = surf.n, face = c => (c / (n * n)) | 0;
  let crossed = false, moved = 0;
  for (let i = 0; i < 3 * n; i++) {
    if (!playerMove('down')) break;
    moved++;
    for (let j = 0; j < 3; j++) tickMeta(1/30);   // カメラが追いかける
    if (face(player.c) !== 0) { crossed = true; break; }
  }
  assert('立方体: 下へ描き進めると隣の面へ', crossed && player.drawing, 'moved=' + moved + ' face=' + face(player.c));
  const f1 = face(player.c);
  for (let i = 0; i < 5; i++) { playerMove('down'); tickMeta(1/30); }
  assert('立方体: 継ぎ目の先でも同じ面を直進', face(player.c) === f1 && player.drawing, face(player.c));
  // 導火線でミス → 軌跡は消える
  for (let i = 0; i < 400 && deathTimer <= 0; i++) updateFuse(1/30, false);
  applyDeath();
  assert('立方体: ミスで軌跡が消え陣地に戻る', countCells(TRAIL) === 0 && isBoundary(player.c) && face(player.c) === 0);
}

// ---- 22) 立方体: QIX2体の分断 → 即クリア ----
initLevel(3); setState('play');
{
  assert('立方体AREA3でQIX2体', qixes.length === 2);
  const n = surf.n;
  qixes[0].p = vnorm([-1, 0.1, -0.3]); qixes[1].p = vnorm([1, 0.1, -0.3]);
  // x≈0 の大円に沿った1マス幅の輪を壁にする(HOMEの真上の1マスだけ残し、そこを自機が描いて閉じる)
  const ring = [];
  for (let c = 0; c < surf.N; c++) {
    const x = surf.dir[c * 3];
    if (x >= 0 && x < 1 / n && grid[c] === OPEN) ring.push(c);
  }
  const gap = ring.find(c => nbs(c).some(b => isBoundary(b)));
  for (const c of ring) if (c !== gap) { grid[c] = WALL; colA[c] = 0; claimed++; }
  const onOpen = qixes.every(openAt);
  const from = nbs(gap).find(b => isBoundary(b));
  player.c = from; player.drawing = false; player.invuln = 0; held.fast = true;
  playerStep(gap);
  const to = nbs(gap).find(b => b !== from && grid[b] === WALL);
  if (player.drawing) playerStep(to);
  assert('立方体: QIXが輪の両側の空き地に居る', onOpen, 'ring=' + ring.length);
  assert('立方体: 分断で即クリア', state === 'clear' && wasSplit, 'state=' + state + ' pct=' + percent().toFixed(1));
  assert('立方体: 圧殺されたQIXが除去', qixes.length === 1);
}

// ---- 23) タイトルで盤面モード切替 ----
setState('title'); settings.mode = 'TOUR';
cycleMode(1);
assert('モード切替 TOUR→DAILY', settings.mode === 'DAILY' && surf.key === dailyList()[0]);
cycleMode(1); cycleMode(1);
assert('モード切替 DAILY→ZEN→PLANE', settings.mode === 'PLANE' && surf.key === 'PLANE');
cycleMode(1); cycleMode(1);
assert('モード切替 →SPHERE で盤面も球に', settings.mode === 'SPHERE' && surf.key === 'SPHERE');
for (let i = 5; i < MODES.length; i++) cycleMode(1);
assert('モード切替は一周する', settings.mode === 'TOUR', MODES.length);
for (let i = 0; i < 60; i++) tickMeta(1/60);
assert('タイトル中も動作(カメラ回転で例外なし)', state === 'title');

// ---- 24) モード別ハイスコア ----
settings.mode = 'CUBE'; hiScore = hiOf('CUBE'); score = hiScore + 1234; saveHi();
assert('ハイスコアはモード別に保存', hiOf('CUBE') === score && store.get('qlaim.hi3', {}).CUBE === score);

// ---- 25) 描画(3D/2D)が例外なく走る ----
let renderErr = null;
try {
  for (const md of ['SPHERE', 'CUBE', 'PLANE']) { settings.mode = md; startGame(); stTimer = 2; tickMeta(0.016); render(); }
} catch (e) { renderErr = e.stack; }
assert('3D/2D描画が例外なし', !renderErr, renderErr);


// ---- 26) すべての立体の形: 形・つながり・遊べること ----
function stepK(k) { return playerStep(surf.nb[player.c * 4 + k]); }
for (const key of Object.keys(CONFIG.SURF)) {
  if (key === 'PLANE') continue;
  const S = getSurface(key), nbOf = c => Array.from(S.nb.slice(c * 4, c * 4 + 4));
  let bad = 0, asym = 0, rbad = 0;
  for (let c = 0; c < S.N; c++) {
    const ns = nbOf(c);
    const ok = ns.filter(b => b >= 0);
    if (new Set(ok).size !== ok.length || ok.includes(c) || (!S.border && ok.length !== 4)) bad++;
    for (const b of ok) if (!nbOf(b).includes(c)) asym++;
    const r = Math.hypot(S.pos[c * 3], S.pos[c * 3 + 1], S.pos[c * 3 + 2]);
    const nl = Math.hypot(S.nor[c * 3], S.nor[c * 3 + 1], S.nor[c * 3 + 2]);
    if (!(r < 1.001) || Math.abs(nl - 1) > 1e-3) rbad++;
  }
  assert(key + ': 4近傍が正しく対称', bad === 0 && asym === 0, 'N=' + S.N + ' bad=' + bad + ' asym=' + asym);
  assert(key + ': 表面の点が半径1以内・法線が単位長', rbad === 0, rbad);
  settings.mode = key; startGame(); stTimer = 2; tickMeta(0.016);
  const ok0 = state === 'play' && isBoundary(player.c) && qixes.every(openAt) && initOpen === countCells(OPEN);
  for (let i = 0; i < 300; i++) updateQixes(1/60);
  for (let i = 0; i < 100; i++) sparxes.forEach(stepSparx);
  const spOk = sparxes.every(s => isBoundary(s.c));
  // HOMEから外へ4マス → 横へ3マス → 戻って HOME にぶつかるまで
  player.invuln = 99; held.fast = false;
  const c0 = claimed;
  let a = 0; for (let i = 0; i < 4; i++) if (stepK(0)) a++;
  let b = 0; for (let i = 0; i < 3; i++) if (stepK(1)) b++;
  for (let i = 0; i < 20 && player.drawing; i++) stepK(2);
  assert(key + ': 開始・QIX/SPARXが正常・囲んで占領できる',
    ok0 && spOk && qixes.every(openAt) && a === 4 && b === 3
    && !player.drawing && claimed > c0 && claimed === initOpen - countCells(OPEN) && isBoundary(player.c),
    'ok0=' + ok0 + ' a/b=' + a + '/' + b + ' claimed=' + (claimed - c0));
  let err = null;
  try { for (let i = 0; i < 3; i++) { tickMeta(1/60); render(); } } catch (e) { err = e.stack; }
  assert(key + ': 描画が例外なし', !err, err);
}

// ---- 27) ドーナツ・クラインの壺の貼り合わせ ----
for (const [key, loopU] of [['TORUS', 1], ['KLEIN', 2], ['MOBIUS', 2], ['KNOT', 1]]) {
  const S = getSurface(key), nbOf = c => Array.from(S.nb.slice(c * 4, c * 4 + 4));
  const walk = (start, k0, len) => {
    let prev = start, c = S.nb[start * 4 + k0];
    for (let s = 1; s < len; s++) { const kp = nbOf(c).indexOf(prev); prev = c; c = S.nb[c * 4 + ((kp + 2) & 3)]; }
    return c;
  };
  const st = 5 * S.NU + 7;
  assert(key + ': u方向に直進すると' + (loopU === 2 ? '2周で(裏返って)' : '1周で') + '戻る',
    walk(st, 1, loopU * S.NU) === st && (loopU === 1 || walk(st, 1, S.NU) !== st));
  if (!S.border) assert(key + ': v方向に直進すると1周で戻る', walk(st, 2, S.NV) === st);
  else assert(key + ': 縁の外は -1(行き止まり)', S.nb[st % S.NU * 4] === -1 || S.nb[(st % S.NU) * 4] === -1);
}
{
  const S = getSurface('KLEIN');
  const c = S.cellIdx(S.NU - 1, 3), n = S.nb[c * 4 + 1];
  assert('KLEIN: 右端の先は左端の上下反転の位置', n === S.cellIdx(0, S.NV / 2 - 1 - 3), n);
}

// ---- 28) 塗りの波 ----
settings.mode = 'SPHERE'; startGame(); stTimer = 2; tickMeta(0.016);
player.invuln = 99;
for (let i = 0; i < 4; i++) stepK(0); for (let i = 0; i < 3; i++) stepK(1); for (let i = 0; i < 20 && player.drawing; i++) stepK(2);
{
  let later = 0, set = 0;
  for (let c = 0; c < surf.N; c++) if (claimAt[c] > -1e8) { set++; if (claimAt[c] > blinkT) later++; }
  assert('塗りの波: 囲んだセルに到達時刻が付き、遠くは後から光る', set > 0 && later > 0 && waveUntil > blinkT, set + '/' + later);
  assert('光の輪が出る', rings.length > 0);
}

// ---- 29) BGM: 全曲の譜面と選び方 ----
{
  let bad = [];
  for (const k in BGMDATA) for (const tr of BGMDATA[k].tracks) {
    if (tr.s && tr.s.length !== BGMDATA[k].len) bad.push(k + ' len');
    if (tr.p && tr.p.some(x => x >= BGMDATA[k].len)) bad.push(k + ' step');
  }
  assert('全曲: トラック長とステップがlen内', bad.length === 0, bad.join(','));
  assert('全盤面のAUTO曲が存在', Object.values(CONFIG.SURF).every(d => BGMDATA[d.music]));
  assert('BGM選択肢の曲が存在', Object.values(MUSIC_SONG).every(k => BGMDATA[k]));
  settings.music = 'IDM'; assert('BGM=IDM を選ぶとidm', bgmName() === 'idm');
  settings.music = 'AUTO'; settings.mode = 'KLEIN'; initLevel(1);
  assert('AUTOは盤面ごとの曲(クラインの壺=drone)', bgmName() === 'drone');
  optSel = OPT_ITEMS.findIndex(o => o.k === 'music'); adjustOpt(1);
  assert('OPTIONSでBGMを切替', settings.music === 'SPLASH', settings.music);
  settings.music = 'AUTO';
}

// ---- 30) 動くテーマ ----
{
  settings.theme = THEMES.findIndex(t => t.name === 'PRISM'); applyTheme();
  const before = themePal.join();
  for (let i = 0; i < 30; i++) tickTheme(1/30);
  assert('PRISMテーマは色が移ろう', themePal.join() !== before && col3D.every(c => /^rgb\(/.test(c)));
  settings.theme = 0; applyTheme();
}

// ---- 31) Clawd ----
{
  let err = null;
  try { drawClawd(100, 100, 2, { moving: true, walkF: 1, drawing: true, look: -1 }); drawClawd(0, 0, 1, { dead: true }); }
  catch (e) { err = e.stack; }
  assert('Clawdが描ける', !err, err);
  settings.mode = 'PLANE'; startGame(); stTimer = 2; tickMeta(0.016);
  held.fast = false; steps(-1, 0, 1);
  assert('歩くと向きと歩き時刻が変わる', player.look === -1 && player.moveT === blinkT);
}


// ---- 32) アイテム: 囲むと手に入る ----
function claimBox() { // HOMEから外へ4 → 横へ3 → 戻る(立体・平面どちらも格子の向きで)
  for (let i = 0; i < 4; i++) stepK(0); for (let i = 0; i < 3; i++) stepK(1);
  for (let i = 0; i < 20 && player.drawing; i++) stepK(2);
}
settings.mode = 'SPHERE'; startGame(); stTimer = 2; tickMeta(0.016); player.invuln = 99;
{
  // 囲まれる予定の場所(HOMEのすぐ外側の内側セル)にアイテムを置く
  const c0 = player.c, a1 = surf.nb[c0 * 4], a2 = surf.nb[a1 * 4], inside = surf.nb[a2 * 4 + 1];
  items = [{ c: inside, k: 'slow', t: 0 }, { c: surf.nb[surf.nb[inside * 4] * 4], k: 'star', t: 0 }];
  const livesB = lives;
  claimBox();
  assert('囲んだアイテムを取得(SLOW発動)', slowT > 0 && !items.some(it => it.k === 'slow'), 'slowT=' + slowT.toFixed(1));
  assert('SLOW中は敵の速さが下がる', enemySlow() < 1);
  items = [{ c: 0, k: 'life', t: 0 }]; grid[0] = WALL; collectItems();
  assert('1UPで残機+1', lives === livesB + 1);
  items = [{ c: 0, k: 'shield', t: 0 }]; collectItems();
  assert('SHIELDを持つ', player.shield === true);
  player.invuln = 0; const l0 = lives; death();
  assert('SHIELDでミスを防ぐ(GUARD)', guarded && deathTimer > 0);
  for (let i = 0; i < 60 && deathTimer > 0; i++) update(1/30);
  assert('SHIELD使用後も残機は減らない・SHIELDは消える', lives === l0 && !player.shield && !guarded, lives + '/' + l0);
}
{
  items = []; itemTimer = 0; updateItems(0.01);
  assert('時間でアイテムが出現(空き地に)', items.length === 1 && grid[items[0].c] === OPEN);
  items[0].t = CONFIG.ITEM_LIFE; updateItems(0.01);
  assert('時間切れでアイテムが消える', items.length === 0);
}

// ---- 33) コンボとSTAR ----
settings.mode = 'PLANE'; startGame(); stTimer = 2; tickMeta(0.016); player.invuln = 99; held.fast = false;
{
  const s0 = score; steps(0, -1, 3); steps(-1, 0, 3); steps(0, 1, 5);
  const p1 = score - s0;
  assert('1回目はコンボなし', combo === 0 && comboT > 0);
  const s1 = score; steps(-1, 0, 4); steps(0, -1, 3); steps(-1, 0, 3); steps(0, 1, 5);
  assert('続けて囲むとコンボ', combo === 1, 'combo=' + combo + ' +' + (score - s1));
  comboT = 0; starT = 5; const s2 = score;
  steps(-1, 0, 4); steps(0, -1, 3); steps(-1, 0, 3); steps(0, 1, 5);
  assert('STAR中は得点2倍(同じ大きさの囲みで2倍)', score - s2 === p1 * 2, (score - s2) + ' vs ' + p1 * 2);
}

// ---- 34) 記録・ポーズメニュー・なぞり操作・裏側ビュー ----
{
  settings.mode = 'CUBE'; startGame(); stTimer = 2; tickMeta(0.016);
  claimed = Math.ceil(initOpen * 0.8); startClear(false);
  assert('クリアで盤面の最高占領率を記録', bestPct.CUBE >= 80 && store.get('qlaim.best', {}).CUBE >= 80, bestPct.CUBE);
  startGame(); stTimer = 2; tickMeta(0.016);
  togglePause();
  assert('ポーズでメニュー', state === 'pause' && pauseSel === 0);
  pauseChoose(1);
  assert('「はじめから」でAREA1から', state === 'ready' && level === 1);
  stTimer = 2; tickMeta(0.016); togglePause(); pauseChoose(4);
  assert('「タイトルへ」', state === 'title');
  assert('なぞりの向き', dirFromDrag(30, 5) === 'right' && dirFromDrag(-3, -40) === 'up' && dirFromDrag(-50, 10) === 'left' && dirFromDrag(2, 9) === 'down');
  let err = null;
  try { for (const md of ['CUBE', 'KLEIN', 'TORUS']) { settings.mode = md; startGame(); stTimer = 2; tickMeta(0.016); items = [{ c: 5, k: 'star', t: 0 }]; render(); } }
  catch (e) { err = e.stack; }
  assert('裏側ビュー・アイテム・状態表示の描画が例外なし', !err, err);
}

// ---- 35) 曲の構成(セクションが巡る) ----
{
  let bad = [];
  for (const k in BGMDATA) {
    const sg = BGMDATA[k];
    if (!sg.form || sg.form.length < 3) bad.push(k + ':formなし');
    else for (const sec of sg.form) {
      if (!(sec.n >= 1)) bad.push(k + ':n');
      if (sec.mute && sec.mute.some(i => i < 0 || i >= sg.tracks.length)) bad.push(k + ':mute');
    }
    for (const tr of sg.tracks) {
      if (tr.s2 && tr.s2.length !== sg.len) bad.push(k + ':s2長');
      if (tr.s2) for (const nm of tr.s2) if (nm && !/^([A-G])(#?)(-?\d)$/.test(nm)) bad.push(k + ':' + nm);
      if (tr.p2 && tr.p2.some(x => x >= sg.len)) bad.push(k + ':p2');
    }
    if (!sg.form || !sg.form.some(x => x.alt || x.t || x.drums === false || x.mute)) bad.push(k + ':変化なし');
  }
  assert('全曲に構成があり、別メロ・転調・ブレイクなどの変化を含む', bad.length === 0, bad.join(','));
  Bgm._load('play');
  const seen = [];
  for (let i = 0; i < 20; i++) { seen.push(Bgm.section); Bgm._advance(); }
  assert('曲を進めるとセクションが順に巡って頭に戻る', seen.join('') === '00112334400112334400', seen.join(''));
  Bgm.stop();
}


// ---- 36) ゲームパッド・発光・画面揺れ ----
{
  const gp = { buttons: [{ pressed: true }, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, { pressed: true }, {}], axes: [0, 0.9] };
  const ks = padKeys(gp);
  assert('ゲームパッド: A=z, 十字左, スティック下', ks.has('z') && ks.has('ArrowLeft') && ks.has('ArrowDown'), [...ks].join(','));
  settings.mode = 'PLANE'; startGame(); stTimer = 2; tickMeta(0.016);
  onKeyDown({ key: 'ArrowUp', repeat: false, preventDefault() {} });
  assert('キー処理の関数化(onKeyDown→方向)', currentDir() === 'up');
  onKeyUp({ key: 'ArrowUp', preventDefault() {} });
  assert('onKeyUpで離す', currentDir() === null);
  assert('OPTIONSに発光と画面揺れ', OPT_ITEMS.some(o => o.k === 'glow') && OPT_ITEMS.some(o => o.k === 'shake'));
  let err = null; settings.glow = true;
  try { render(); } catch (e) { err = e.stack; }
  assert('発光つき描画が例外なし', !err, err);
}


// ---- 37) ランキングと名前入力 ----
{
  settings.mode = 'TETRA'; ranks.TETRA = [];
  startGame(); stTimer = 2; tickMeta(0.016);
  score = 5000; lives = 0; player.invuln = 0; death(); for (let i = 0; i < 60 && deathTimer > 0; i++) update(1/30);
  assert('ランキング入りで名前入力へ', state === 'entry', state);
  const ev = key => ({ key, repeat: false, preventDefault() {} });
  onKeyDown(ev('ArrowUp'));
  const c0 = entry.name[0];
  onKeyDown(ev('z')); onKeyDown(ev('q')); onKeyDown(ev('z'));
  assert('名前を決めて登録', state === 'over' && rankOf('TETRA')[0].s === 5000 && entry.rank === 0, JSON.stringify(rankOf('TETRA')));
  assert('文字キーで直接入力', rankOf('TETRA')[0].n[1] === 'Q' && rankOf('TETRA')[0].n[0] === c0);
  for (const sc of [100, 9000, 300, 50, 7000, 20]) addRank('ZZZ', sc, 1);
  const r = rankOf('TETRA');
  assert('上位5件を高い順に保持', r.length === 5 && r[0].s === 9000 && r[4].s === 100 && !qualifies(90) && qualifies(20000), r.map(e => e.s).join(','));
  let err = null; try { render(); setState('entry'); render(); } catch (e) { err = e.stack; }
  assert('ランキング・名前入力の描画が例外なし', !err, err);
}


// ---- 38) DAILY(今日の3面) ----
{
  const a = dailyList('20260924'), b = dailyList('20260924'), c = dailyList('20260925');
  assert('DAILY: 同じ日は同じ3面・別の日は別', a.join() === b.join() && a.join() !== c.join() && new Set(a).size === 3 && !a.includes('PLANE'), a.join() + ' / ' + c.join());
  settings.mode = 'DAILY';
  const d = dailyList();
  assert('DAILY: エリア1〜3が今日の3面', surfaceFor(1) === d[0] && surfaceFor(2) === d[1] && surfaceFor(3) === d[2] && surfaceFor(4) === d[0]);
  assert('DAILY: 記録は日付つきのキー', modeKey() === 'DAILY:' + todayStr());
  startGame(); score = 777; saveHi();
  assert('DAILY: ハイスコアは今日の分として保存', hiOf('DAILY:' + todayStr()) === 777 && hiOf('DAILY') === 0);
  setState('title'); let err = null; try { render(); } catch (e) { err = e.stack; }
  assert('DAILY: タイトル描画', !err, err);
}


// ---- 39) チュートリアル ----
{
  settings.tutor = false; settings.mode = 'PLANE'; startGame(); stTimer = 2; tickMeta(0.016);
  assert('初回はチュートリアル開始', tutorStep === 0);
  held.fast = false; player.invuln = 99;
  steps(-1, 0, 1);
  assert('歩くと次のヒント', tutorStep === 1);
  steps(0, -1, 2);
  assert('線を引くと次のヒント', tutorStep === 2);
  steps(-1, 0, 2); steps(0, 1, 5);
  assert('囲むと次のヒント', tutorStep === 3);
  for (let i = 0; i < 400 && tutorStep >= 0; i++) update(1/60);
  assert('最後のヒントは時間で終わり、以後出ない', tutorStep === -1 && settings.tutor === true);
  startGame();
  assert('2回目はチュートリアルなし', tutorStep === -1);
  let err = null; settings.tutor = false; startGame(); stTimer = 2; tickMeta(0.016);
  try { render(); } catch (e) { err = e.stack; }
  assert('チュートリアル描画が例外なし', !err, err);
  settings.tutor = true; tutorStep = -1;
  assert('スクリーンショットはtoBlobが無い環境では何もしない', saveShot() === false);
}


// ---- 40) SEEKER ----
{
  settings.mode = 'PLANE'; settings.tutor = true;
  startGame(); initLevel(3);
  assert('AREA3までSEEKERなし', seekers.length === 0);
  initLevel(4); setState('play');
  assert('AREA4でSEEKER出現(空き地)', seekers.length === 1 && grid[seekers[0].c] === OPEN);
  for (let i = 0; i < 300; i++) updateSeekers(1/60);
  assert('SEEKERは空き地を動く', grid[seekers[0].c] === OPEN);
  // 追跡: 線を引いている最中は自機へ近づく
  player.invuln = 99; held.fast = false; steps(0, -1, 3);
  const P = surf.pos, dist = c => Math.hypot(P[c * 3] - P[player.c * 3], P[c * 3 + 1] - P[player.c * 3 + 1]);
  const d0 = dist(seekers[0].c);
  for (let i = 0; i < 20; i++) stepSeeker(seekers[0]);
  assert('線を引いている間は自機へ近づく', dist(seekers[0].c) < d0, d0.toFixed(1) + '→' + dist(seekers[0].c).toFixed(1));
  // 囲んで倒す: SEEKERを自機の近くに置いて囲う
  applyDeath(); player.invuln = 99; lives = 3;
  const x0 = player.c % GW;
  seekers[0].c = idx(x0 - 2, GH - 3);
  const sc0 = score;
  steps(0, -1, 4); steps(-1, 0, 4); steps(0, 1, 6);
  assert('囲むとSEEKERを倒してボーナス', seekers.length === 0 && score - sc0 >= CONFIG.SEEKER_BONUS, 'n=' + seekers.length);
  // 描きかけの線に触れるとミス
  initLevel(4); setState('play'); player.invuln = 0; steps(0, -1, 3);
  seekers[0].c = trail[1]; seekers[0].acc = 0; player.invuln = 0;
  grid[trail[1]] = TRAIL;
  seekers[0].c = surf.nb[trail[1] * 4 + 1]; seekers[0].prev = -1;
  if (grid[seekers[0].c] === OPEN) { seekers[0].acc = 0; for (let i = 0; i < 50 && deathTimer <= 0; i++) { stepSeeker(seekers[0]); if (grid[seekers[0].c] === TRAIL || seekers[0].c === player.c) death(); } }
  assert('線に触れるとミス', deathTimer > 0);
  let err = null; try { render(); settings.mode = 'SPHERE'; startGame(); initLevel(5); setState('play'); render(); } catch (e) { err = e.stack; }
  assert('SEEKERの描画が例外なし', !err, err);
}


// ---- 41) 音の反応(AudioContext無しでも安全) ----
{
  let err = null;
  try { Snd.react(900, 0.5); Snd.sweep(); setState('pause'); tickMeta(0.016); setState('play'); tickMeta(0.016); } catch (e) { err = e.stack; }
  assert('BGMのこもり・効果音の左右がAC無しでも安全', !err, err);
}


// ---- 42) コンティニュー ----
{
  settings.mode = 'PLANE'; ranks.PLANE = [{ n: 'TOP', s: 99999999, a: 99 }, { n: 'TOP', s: 99999998, a: 99 }, { n: 'TOP', s: 99999997, a: 99 }, { n: 'TOP', s: 99999996, a: 99 }, { n: 'TOP', s: 99999995, a: 99 }];
  startGame(); initLevel(5); level = 5; setState('play'); score = 1234;
  lives = 0; player.invuln = 0; death(); for (let i = 0; i < 60 && deathTimer > 0; i++) update(1/30);
  assert('ゲームオーバーでコンティニュー受付', state === 'over' && canContinue());
  stTimer = 1; onAction();
  assert('Zで同じエリアから続ける(残機回復・スコアは0から)', state === 'ready' && level === 5 && lives === settings.lives && score === 0 && continues === 1);
  setState('play'); lives = 0; player.invuln = 0; death(); for (let i = 0; i < 60 && deathTimer > 0; i++) update(1/30);
  stTimer = 1; giveUp();
  assert('Xでやめるとカウントダウン終了', !canContinue());
  onAction();
  assert('その後Zでタイトルへ', state === 'title');
  let err = null; try { setState('over'); stTimer = 2; render(); } catch (e) { err = e.stack; }
  assert('コンティニュー表示が例外なし', !err, err);
}


// ---- 43) 実績 ----
{
  for (const k in achvGot) delete achvGot[k];
  settings.mode = 'PLANE'; startGame(); stTimer = 2; tickMeta(0.016);
  areaTime = 30; claimed = Math.ceil(initOpen * 0.92); startClear(false);
  assert('クリアで実績(初クリア・ノーミス・スピード・90%・Z不使用)',
    ['first', 'nomiss', 'speed', 'pct90', 'slowonly'].every(id => achvGot[id]), Object.keys(achvGot).join(','));
  assert('実績のお知らせが出る', achvToasts.length >= 1);
  for (let i = 0; i < 3000 && achvToasts.length; i++) updateFloats(1/30);
  assert('お知らせは時間で消える', achvToasts.length === 0);
  assert('同じ実績は二度出ない', unlock('first') === false);
  for (const k of Object.keys(ITEMS)) itemsGot[k] = 1;   // (ZAP 追加後も全種)
  startGame(); stTimer = 2; tickMeta(0.016); items = [{ c: 0, k: 'star', t: 0 }]; grid[0] = WALL; collectItems();
  assert('アイテム4種で「コレクター」', !!achvGot.items);
  for (const k of ['TETRA', 'CUBE', 'OCTA', 'DODECA', 'ICOSA']) bestPct[k] = 80;
  checkClearAchv(false);
  assert('正多面体5種で「プラトンの立体」', !!achvGot.platonic && !achvGot.all);
  setState('options'); optSel = OPT_ITEMS.findIndex(o => o.k === '_achv'); adjustOpt(1);
  assert('OPTIONSから実績一覧へ', state === 'achv');
  let err = null; try { render(); } catch (e) { err = e.stack; }
  assert('実績一覧の描画が例外なし', !err, err);
  onKeyDown({ key: 'z', repeat: false, preventDefault() {} });
  assert('Zで戻る', state === 'options');
}


// ---- 44) 年輪模様とズーム ----
{
  settings.mode = 'CUBE'; settings.tutor = true; startGame(); stTimer = 2; tickMeta(0.016); player.invuln = 99;
  for (let i = 0; i < 8; i++) stepK(0); for (let i = 0; i < 4; i++) stepK(1);
  cam.D = 3.4; const D0 = cam.D; for (let i = 0; i < 60; i++) tickMeta(1/60);
  assert('線を引いている間はカメラが引く', cam.D > D0 + 0.2, D0.toFixed(2) + '→' + cam.D.toFixed(2));
  for (let i = 0; i < 30 && player.drawing; i++) stepK(2);
  let r0 = 0, r1 = 0;
  for (let c = 0; c < surf.N; c++) if (claimAt[c] > -1e8 && colA[c] > 0 && colA[c] !== HOME_COL) { if (ringA[c]) r1++; else r0++; }
  assert('囲んだ陣地に年輪の縞(両方の色がある)', r0 > 0 && r1 > 0, r0 + '/' + r1);
  for (let i = 0; i < 120; i++) tickMeta(1/60);
  assert('描き終わるとカメラが戻る', Math.abs(cam.D - 3.4) < 0.05, cam.D.toFixed(2));
}


// ---- 45) タイトルのデモ ----
{
  settings.mode = 'TOUR'; backToTitle(); cycleMode(0);
  const k0 = surf.key;
  for (let i = 0; i < 9 * 60; i++) tickMeta(1/60);
  assert('タイトル(TOUR)で背景の盤面が巡る', surf.key !== k0 && state === 'title', k0 + '→' + surf.key);
  startGame();
  assert('スタートするとAREA1の盤面から', surf.key === surfaceFor(1) && level === 1);
  settings.mode = 'CUBE'; backToTitle(); cycleMode(0);
  for (let i = 0; i < 9 * 60; i++) tickMeta(1/60);
  assert('単独の盤面を選んでいるときは巡らない', surf.key === 'CUBE');
}


// ---- 46) 自動軽量化 ----
{
  settings.mode = 'PLANE'; startGame(); stTimer = 2; tickMeta(0.016); settings.glow = true; perf.lite = false; perf.avg = 1 / 60;
  for (let i = 0; i < 200; i++) watchPerf(1 / 60);
  assert('軽いときは発光のまま', settings.glow === true);
  for (let i = 0; i < 200; i++) watchPerf(0.05);
  assert('重い状態が続くと発光を自動でOFF(設定は変えない)', settings.glow === true && perf.lite);
  perf.lite = false;
  settings.glow = true;
}


// ---- 47) 追加曲(シンセウェイブ・ローファイ) ----
{
  assert('SYNTH/LOFI が選べて盤面にも割り当て', BGMDATA.synth && BGMDATA.lofi && MUSIC_KEYS.includes('LOFI')
    && CONFIG.SURF.MOBIUS.music === 'lofi' && BGMDATA.lofi.swing > 0);
}


// ---- 48) 音に合わせた脈動 ----
assert('脈動はAC無しなら0', Bgm.pulse() === 0);


// ---- 49) BONUS AREA ----
{
  settings.mode = 'PLANE'; settings.tutor = true; startGame(); level = 5; initLevel(5); setState('play');
  assert('AREA5はBONUS AREA(SPARX/SEEKERなし・制限時間あり)', bonusT > 0 && sparxes.length === 0 && seekers.length === 0, bonusT);
  player.invuln = 99; held.fast = true; steps(0, -1, 20); steps(-1, 0, 20); steps(0, 1, 30);
  const pct = percent(), sc = score;
  for (let i = 0; i < 60 * 45 && state === 'play'; i++) update(1/60);
  assert('時間切れでクリア、占領率に応じたボーナス', state === 'clear' && lastBonus >= Math.round(pct * CONFIG.BONUS_PTS), 'bonus=' + lastBonus + ' pct=' + pct.toFixed(1));
  // 描いている最中に時間切れ → 残機は減らず線だけ消える
  level = 5; initLevel(5); setState('play'); player.invuln = 99; held.fast = true; steps(0, -1, 5);
  const lv0 = lives; bonusT = 0.01; update(1/60);
  assert('描画中の時間切れでも残機は減らない', state === 'clear' && lives === lv0 && countCells(TRAIL) === 0 && !player.drawing);
  nextLevel();
  assert('次のエリアは通常(制限時間なし)', level === 6 && bonusT === 0 && sparxes.length > 0);
  let err = null; try { level = 10; initLevel(10); setState('ready'); render(); } catch (e) { err = e.stack; }
  assert('BONUS AREAのREADY表示が例外なし', !err, err);
}


// ---- 50) Clawdの色 ----
{
  for (const k in achvGot) delete achvGot[k];
  settings.skin = 'ORANGE';
  setState('options'); optSel = OPT_ITEMS.findIndex(o => o.k === 'skin'); adjustOpt(1);
  assert('実績なしではORANGEだけ', settings.skin === 'ORANGE' && skinsOpen().length === 1);
  achvGot.first = 'x'; achvGot.klein = 'x';
  adjustOpt(1);
  assert('実績で色が増えて選べる', settings.skin === 'MINT' && clawdCol() === '#5fd6b0');
  adjustOpt(1); assert('次はGHOST(未解除は飛ばす)', settings.skin === 'GHOST');
  delete achvGot.klein;
  assert('選べない色になったら元の色', clawdCol() === CLAWD_COL);
  let err = null; try { render(); } catch (e) { err = e.stack; }
  assert('OPTIONS描画が例外なし', !err, err);
}


// ---- 51) 全体を見る(X) ----
{
  settings.mode = 'DODECA'; startGame(); stTimer = 2; tickMeta(0.016);
  held.slow = true; for (let i = 0; i < 120; i++) tickMeta(1/60);
  assert('Xを押す間はカメラが大きく引く', cam.D > 5, cam.D.toFixed(2));
  held.slow = false; for (let i = 0; i < 180; i++) tickMeta(1/60);
  assert('離すと戻る', Math.abs(cam.D - 3.4) < 0.05, cam.D.toFixed(2));
}


// ---- 52) ZENモード ----
{
  settings.mode = 'ZEN'; startGame(); level = 6; initLevel(6); setState('play');
  assert('ZEN: SPARX・SEEKERなし', sparxes.length === 0 && seekers.length === 0);
  player.invuln = 0; const l0 = lives; death();
  assert('ZEN: ミスにならない', deathTimer <= 0 && lives === l0);
  held.fast = false; stepK(0); stepK(0);
  for (let i = 0; i < 300; i++) updateFuse(1/30, false);
  assert('ZEN: 導火線なし', !fuse.lit && player.drawing);
  score = 99999; saveHi();
  assert('ZEN: 記録しない', !qualifies(99999) && !hiScores.ZEN);
  assert('ZEN: BONUS AREAなし', !isBonus(5));
  const np = particles.length; stepK(0); stepK(0);
  assert('描くとき光の粒がこぼれる', particles.length > np);
}


// ---- 53) あそんだ記録 ----
{
  const g0 = stats.games, c0 = stats.claims;
  settings.mode = 'PLANE'; startGame(); stTimer = 2; tickMeta(0.016); player.invuln = 99; held.fast = false;
  steps(0, -1, 3); steps(-1, 0, 3); steps(0, 1, 5);
  for (let i = 0; i < 60; i++) update(1/60);
  assert('記録: ゲーム回数・囲んだ回数・時間が増える', stats.games === g0 + 1 && stats.claims === c0 + 1 && stats.time > 0.9);
  assert('記録: よく遊ぶ盤面', favSurface() != null);
  setState('options'); optSel = OPT_ITEMS.findIndex(o => o.k === '_stats'); adjustOpt(1);
  let err = null; try { render(); } catch (e) { err = e.stack; }
  assert('記録画面へ・描画が例外なし', state === 'stats' && !err, err);
  onKeyDown({ key: 'x', repeat: false, preventDefault() {} });
  assert('記録画面から戻る', state === 'options');
}


// ---- 54) ポーズからOPTIONS ----
{
  settings.mode = 'PLANE'; startGame(); stTimer = 2; tickMeta(0.016);
  togglePause(); pauseChoose(2);
  assert('ポーズからOPTIONSを開ける', state === 'options');
  optSel = OPT_ITEMS.findIndex(o => o.k === '_back'); closeOptions();
  assert('閉じるとポーズへ戻る', state === 'pause');
  pauseChoose(0);
  assert('そのまま再開できる', state === 'play');
  backToTitle(); openOptions(); closeOptions();
  assert('タイトルから開いたらタイトルへ戻る', state === 'title');
}


// ---- 55) 名前入力で M / C も文字として入る ----
{
  settings.mode = 'OCTA'; ranks.OCTA = []; startGame(); score = 4321; startEntry();
  const ev = key => ({ key, repeat: false, preventDefault() {} });
  onKeyDown(ev('m')); onKeyDown(ev('c')); onKeyDown(ev('9'));
  assert('名前入力でMとCが打てる', state === 'over' && rankOf('OCTA')[0].n === 'MC9', rankOf('OCTA')[0] && rankOf('OCTA')[0].n);
}


// ---- 56) ワープの入場 ----
{
  settings.mode = 'ICOSA'; backToTitle(); startGame();
  assert('タイトルからの開始でもカメラが遠くから', cam.D > 8, cam.D);
  for (let i = 0; i < 90; i++) tickMeta(1/60);
  assert('READYの間に寄ってくる', cam.D < 4, cam.D.toFixed(2));
  let err = null; try { cam.D = 7; render(); } catch (e) { err = e.stack; }
  assert('ワープの星の流れの描画が例外なし', !err, err);
  backToTitle();
  assert('タイトルのデモは普通の距離', cam.D < 9);
}


// ---- 57) 花火・ハモる効果音 ----
{
  settings.mode = 'PLANE'; startGame(); stTimer = 2; tickMeta(0.016);
  claimed = Math.ceil(initOpen * 0.8); startClear(false);
  const n0 = particles.length;
  for (let i = 0; i < 30; i++) updateParticles(1/30);
  assert('クリア中は花火が上がる', particles.length > n0 + 20);
  assert('BGMが無いときの基準音は0(従来の音程)', Bgm.root() === 0);
}


// ---- 58) テーマ AUTO ----
{
  settings.theme = THEMES.length; settings.mode = 'PLANE'; startGame();
  const a = theme().name;
  settings.mode = 'GSD'; startGame();
  const b = theme().name;
  assert('AUTOは盤面で配色が変わる(平面=INK、星型=VAPOR)', a === 'INK' && b === 'VAPOR' && col3D.length === NCOL * LV, a + '/' + b);
  assert('全盤面にAUTOの配色がある', Object.keys(CONFIG.SURF).every(k => THEMES.some(t => t.name === AUTO_THEME[k])));
  settings.theme = 0; applyTheme();
}


// ---- 59) 結果の共有 ----
{
  settings.mode = 'KLEIN'; score = 3210; level = 4; continues = 1;
  const tx = resultText();
  assert('共有の文章に盤面・スコア・URL', tx.includes('クラインの壺') && tx.includes('3210') && tx.includes('AREA 4') && tx.includes(SHARE_URL), tx);
  assert('共有できない環境でも落ちない', shareResult() === 'none');
  setState('over'); stTimer = 20; let err = null; try { render(); } catch (e) { err = e.stack; }
  assert('ゲームオーバー画面(共有ボタン)の描画', !err && shareRect && shareRect.w > 0, err);
}


// ---- 60) QIXの突進 ----
{
  for (const md of ['PLANE', 'SPHERE', 'TORUS']) {
    settings.mode = md; startGame(); level = 6; initLevel(6); setState('play'); player.invuln = 999;
    const q = qixes[0];
    q.dashCD = 0.5; updateQix(q, 0.1);
    const warned = q.warn;
    q.dashCD = 0.01; updateQix(q, 0.02);
    assert(md + ': AREA6から予告して突進', warned && q.dash > 0, 'dash=' + q.dash);
    for (let i = 0; i < 120; i++) updateQixes(1/60);
    assert(md + ': 突進後もQIXは空き地', qixes.every(openAt));
  }
  settings.mode = 'PLANE'; startGame(); level = 5; initLevel(5); setState('play');
  updateQix(qixes[0], 0.1);
  assert('AREA5(BONUS)では突進しない', !(qixes[0].dash > 0) && qixes[0].dashCD == null);
}


// ---- 61) Clawd のひとこと・クリア音 ----
{
  settings.mode = 'PLANE'; startGame(); stTimer = 2; tickMeta(0.016);
  speech.t = 0; speech.cool = 0;
  player.invuln = 0; death();
  assert('ミスでひとこと', (CLAWD_LINES.miss.includes(speech.txt) || RARE_LINES.includes(speech.txt)) && speech.t > 0, speech.txt);
  for (let i = 0; i < 60; i++) updateParticles(1/30);
  assert('吹き出しは時間で消える', speech.t <= 0);
  assert('連発しない(クールダウン中は無視)', say('A') === true && say('B') === false && speech.txt === 'A');
  let err = null; try { speech.t = 1; render(); Snd.clear_(0); Snd.clear_(110); } catch (e) { err = e.stack; }
  assert('吹き出しの描画・クリア音が例外なし', !err, err);
}


// ---- 62) SPARXの見た目(尾) ----
{
  settings.mode = 'PLANE'; startGame(); stTimer = 2; tickMeta(0.016);
  for (let i = 0; i < 20; i++) sparxes.forEach(stepSparx);
  assert('SPARXは通った跡を5つまで覚える', sparxes.every(s => s.hist && s.hist.length === 5));
  let err = null; try { render(); settings.mode = 'SPHERE'; startGame(); stTimer = 2; tickMeta(0.016); sparxes.forEach(s => s.wait = 0); for (let i = 0; i < 10; i++) sparxes.forEach(stepSparx); render(); } catch (e) { err = e.stack; }
  assert('SPARXの描画が例外なし', !err, err);
}


// ---- 63) 危険の知らせ ----
{
  settings.mode = 'PLANE'; startGame(); stTimer = 2; tickMeta(0.016); player.invuln = 0;
  sparxes[0].wait = 0; sparxes[0].c = surf.nb[surf.nb[player.c * 4 + 3] * 4 + 3];
  assert('SPARXが近いと危険度が上がる', calcDanger() > 0.5, danger.toFixed(2));
  sparxes.forEach(sp => sp.c = idx(GW >> 1, 0));
  assert('遠ければ0', calcDanger() === 0);
  let err = null; try { sparxes[0].c = surf.nb[player.c * 4 + 3]; render(); } catch (e) { err = e.stack; }
  assert('危険表示の描画が例外なし', !err, err);
}


// ---- 64) TOURの最高到達エリア ----
{
  settings.mode = 'TOUR'; startGame(); stTimer = 2; tickMeta(0.016);
  for (let i = 0; i < 3; i++) { claimed = Math.ceil(initOpen * 0.8); startClear(false); nextLevel(); }
  assert('TOURの最高到達エリアを記録', stats.maxArea.TOUR >= 4, stats.maxArea.TOUR);
  let err = null; try { render(); backToTitle(); render(); } catch (e) { err = e.stack; }
  assert('HUD・タイトル表示が例外なし', !err, err);
}


// ---- 65) 最後の1機で鼓動 ----
{
  settings.mode = 'PLANE'; startGame(); stTimer = 2; tickMeta(0.016); lives = 0; heartT = 0;
  let err = null; try { update(1/60); } catch (e) { err = e.stack; }
  assert('残機0で鼓動のタイマーが動く(AC無しでも安全)', !err && heartT > 0.8, err || heartT);
}


// ---- 66) クリア中の俯瞰 ----
{
  settings.mode = 'DODECA'; startGame(); stTimer = 2; tickMeta(0.016); cam.D = 3.4;
  claimed = Math.ceil(initOpen * 0.8); startClear(false);
  for (let i = 0; i < 120; i++) tickMeta(1/60);
  assert('クリア中はカメラが引く', cam.D > 4.3, cam.D.toFixed(2));
}


// ---- 67) ZAP ----
{
  settings.mode = 'PLANE'; startGame(); level = 4; initLevel(4); setState('play');
  assert('準備: SPARXとSEEKERがいる', sparxes.length > 0 && seekers.length > 0);
  items = [{ c: 0, k: 'zap', t: 0 }]; grid[0] = WALL; collectItems();
  const c0 = seekers[0].c; updateSeekers(1);
  assert('ZAPでSPARX一掃・SEEKERは止まる', sparxes.length === 0 && seekers[0].c === c0 && seekers[0].stun > 0);
  for (let i = 0; i < 60 * 20; i++) updateSparxes(1/60);
  assert('SPARXはしばらくするとまた出る', sparxes.length > 0);
}


// ---- 68) TOUR 1周でエンディング ----
{
  settings.mode = 'TOUR'; startGame(); level = CONFIG.TOUR.length; initLevel(level); setState('play');
  claimed = Math.ceil(initOpen * 0.8); startClear(false); stTimer = 1; onAction();
  assert('TOURの最後をクリアするとエンディング', state === 'ending' && !!achvGot.tourall);
  let err = null; try { stTimer = 5; render(); for (let i = 0; i < 30; i++) updateParticles(1/30); } catch (e) { err = e.stack; }
  assert('エンディングの描画が例外なし', !err, err);
  onAction();
  assert('Zで2周目(AREA 23 = 平面から)', state === 'ready' && level === CONFIG.TOUR.length + 1 && surf.key === 'PLANE', level + ' ' + surf.key);
}


// ---- 69) RAINBOW ----
{
  achvGot.tourall = 'x'; settings.skin = 'RAINBOW';
  const a = clawdCol(); blinkT += 0.5; const b = clawdCol();
  assert('RAINBOWは色が変わり続ける', /^#[0-9a-f]{6}$/.test(a) && a !== b, a + ' ' + b);
  delete achvGot.tourall;
  assert('未解除ならオレンジ', clawdCol() === CLAWD_COL);
  settings.skin = 'ORANGE';
}


// ---- 70) 盤面の豆知識 ----
assert('全盤面に豆知識がある', Object.keys(CONFIG.SURF).every(k => SURF_INFO[k]));


// ---- 71) あそびかた ----
{
  settings.mode = 'PLANE'; backToTitle();
  onKeyDown({ key: 'h', repeat: false, preventDefault() {} });
  assert('タイトルでHを押すとあそびかた', state === 'help');
  let err = null; try { render(); } catch (e) { err = e.stack; }
  assert('あそびかたの描画が例外なし', !err, err);
  onKeyDown({ key: 'z', repeat: false, preventDefault() {} });
  assert('Zでタイトルへ戻る', state === 'title');
  startGame(); stTimer = 2; tickMeta(0.016); togglePause(); pauseChoose(3);
  assert('ポーズからあそびかた', state === 'help');
  closeHelp();
  assert('閉じるとポーズへ', state === 'pause');
}


// ---- 72) もう一度・DAILYの日付 ----
{
  settings.mode = 'DAILY'; startGame(); score = 10;
  assert('DAILYの共有文に日付', /\d{4}\/\d{2}\/\d{2}/.test(resultText()), resultText());
  setState('over'); stTimer = 1;
  onKeyDown({ key: 'r', repeat: false, preventDefault() {} });
  assert('Rですぐもう一度', state === 'ready' && level === 1 && score === 0);
}


// ---- 73) 振動 ----
{
  settings.shake = false;
  assert('画面揺れOFFなら振動しない', buzz(100) === false);
  settings.shake = true;
}


// ---- 74) ニアミス ----
{
  settings.mode = 'PLANE'; startGame(); stTimer = 2; tickMeta(0.016); player.invuln = 0; held.fast = true;
  steps(0, -1, 30);
  const tc = trail[15], x = tc % GW, y = (tc / GW) | 0;
  // 体は線に触れない距離、触手だけ線の隣をかすめる
  const q = qixes[0]; q.x = x + 4.5; q.y = y + 0.5; q.segs = [{ x1: x + 1.5, y1: y - 4, x2: x + 1.5, y2: y + 4, h: 0 }]; q.segT = 1; q.spd = 0;
  const sc = score; nearMissT = 0;
  updateQix(q, 0.001);
  assert('線の隣をかすめるとニアミスボーナス', deathTimer <= 0 && score > sc && nearMissT > 0, score - sc);
  const sc2 = score; updateQix(q, 0.001);
  assert('連続では入らない', score === sc2);
}


// ---- 75) 追加の実績 ----
{
  delete achvGot.nearmiss; delete achvGot.bonus50;
  settings.mode = 'PLANE'; startGame();
  for (let i = 0; i < 5; i++) { nearMissT = 0; nearMiss(); }
  assert('ニアミス5回で「ギリギリの達人」', !!achvGot.nearmiss);
  level = 5; initLevel(5); setState('play'); claimed = Math.ceil(initOpen * 0.55); startClear(false);
  assert('BONUS AREAで50%以上で「ボーナスハンター」', !!achvGot.bonus50);
  setState('achv'); let err = null; try { render(); } catch (e) { err = e.stack; }
  assert('実績一覧(23件)の描画', !err && ACHV.length === 23, err || ACHV.length);
}


// ---- 76) 曲名 ----
assert('全曲に表示名がある', Object.keys(BGMDATA).every(k => SONG_LABEL[k]));


// ---- 77) あそびかたから P でも戻れる ----
{
  settings.mode = 'PLANE'; startGame(); stTimer = 2; tickMeta(0.016); togglePause(); pauseChoose(3);
  onKeyDown({ key: 'p', repeat: false, preventDefault() {} });
  assert('あそびかたからPでポーズへ戻る', state === 'pause');
}


// ---- 78) ハイスコア更新の表示 ----
{
  settings.mode = 'ICOSA'; startGame(); score = startHi + 1; setState('over'); stTimer = 20;
  let err = null; try { render(); } catch (e) { err = e.stack; }
  assert('ハイスコア更新の表示が例外なし', !err && score > startHi, err);
}


// ---- 79) 音楽の強化 ----
{
  assert('平面の曲はスプラッシュ(ファンク)', CONFIG.SURF.PLANE.music === 'splash' && BGMDATA.splash.form.length >= 5);
  let err = null;
  try { Snd.note(440, 0, 0.2, 'square', 0.1, 0.01, 0.05, 6, { flt: [2000, 300, 5], vib: [5, 10], pn: 0.3, rv: 0.3 }); Snd.ohat(0, 0.1); Snd.clap(0, 0.1); Snd.tom(0, 0.1, 150); Snd.crash(0, 0.1); }
  catch (e) { err = e.stack; }
  assert('新しい音色・打楽器はAC無しでも安全', !err, err);
  Bgm._load('splash'); assert('曲の読み込み', Bgm.section === 0); Bgm.stop();
}


// ---- 80) buddy たち ----
buddiesOn = true;
{
  // 登場順: 9エリアで18種全員
  const all = new Set(); for (let lv = 1; lv <= 9; lv++) buddiesFor(lv).forEach(k => all.add(k));
  assert('9エリアで18種全員が登場する', all.size === 18 && Object.keys(BUDDIES).length === 18, all.size);
  const mk = (k, lv) => { settings.mode = 'PLANE'; startGame(); level = lv || 1; initLevel(level); setState('play'); buddies = []; fireballs = []; sparxes = []; seekers = []; const b = spawnBuddy(k); b.shiny = false; return b; };
  // 味方: 囲んで助ける
  let b = mk('axolotl'); player.invuln = 99; held.fast = false;
  const x0 = player.c % GW; b.c = idx(x0 - 2, GH - 3); const l0 = lives;
  steps(0, -1, 4); steps(-1, 0, 4); steps(0, 1, 6);
  assert('迷子のウーパールーパーを囲んで助けると残機+1', buddies.length === 0 && lives === l0 + 1, lives + '/' + l0);
  // いたずら組: 囲むとつかまえる
  b = mk('goose'); player.invuln = 99; b.c = idx(x0 - 2, GH - 3); const s0 = score;
  steps(0, -1, 4); steps(-1, 0, 4); steps(0, 1, 6);
  assert('ガチョウを囲むとつかまえる', buddies.length === 0 && score > s0);
  // ガチョウはアイテムを取る
  b = mk('goose'); items = [{ c: idx(60, 60), k: 'star', t: 0 }]; b.c = idx(55, 60);
  for (let i = 0; i < 120; i++) updateBuddies(1/30);
  assert('ガチョウがアイテムを横取り', items.length === 0);
  // カタツムリ: 陣地をかじる(占領率が下がる・整合は保つ)
  b = mk('snail'); player.invuln = 99; steps(0, -1, 10); steps(-1, 0, 10); steps(0, 1, 12);
  const c1 = claimed; b.c = idx(x0 - 10, GH - 11); b.cd = 0;
  for (let i = 0; i < 30; i++) updateBuddies(0.2);
  assert('カタツムリが陣地をかじる(占領数が減り整合も保つ)', claimed < c1 && claimed === initOpen - countCells(OPEN), c1 + '→' + claimed);
  assert('外枠(最初の壁)はかじらない', [0, GW - 1, idx(0, GH - 1)].every(c => grid[c] === WALL));
  // さわると追い払える
  b.c = surf.nb[player.c * 4 + 3]; b.cd = 99;
  const nb3 = b.c; if (isBoundary(nb3)) { playerStep(nb3); for (const bb of buddies.slice()) if (bRole(bb) === 'eater' && bb.c === player.c) shoo(bb); }
  assert('カタツムリにさわると追い払える', !buddies.some(x => x.k === 'snail') || !isBoundary(nb3));
  // ネコ: 通せんぼ
  b = mk('cat'); const nx = surf.nb[player.c * 4 + 3]; b.c = nx; b.cd = 99;
  assert('ネコのいるマスには入れない', playerStep(nx) === false && buddyBlocks(nx));
  // サボテン: 線で触れるとミス
  b = mk('cactus'); player.invuln = 0; b.c = idx(player.c % GW, GH - 3); held.fast = false;
  steps(0, -1, 3); updateBuddies(0.01);
  assert('サボテンに線で触れるとミス', deathTimer > 0);
  // ドラゴン: 火の玉
  b = mk('dragon', 3); player.invuln = 0; held.fast = true; steps(0, -1, 30);
  b.c = idx(0, GH - 20); b.cd = 0; updateBuddies(0.01);
  assert('ドラゴンが火の玉を吐く', fireballs.length === 1 || deathTimer > 0, fireballs.length);
  // ブロブ: インクボム
  b = mk('blob'); const c2 = claimed; b.c = idx(64, 80); inkBomb(b.c, 5);
  assert('ブロブのインクボムで陣地が増える(整合)', claimed > c2 + 20 && claimed === initOpen - countCells(OPEN));
  // 図鑑・描画
  let err = null;
  try { for (const k of Object.keys(BUDDIES)) drawBuddy(k, 100, 100, 1, { ph: 1, warn: true }); setState('dex'); render(); settings.mode = 'SPHERE'; startGame(); level = 8; initLevel(8); setState('play'); render(); }
  catch (e) { err = e.stack; }
  assert('buddy18種・図鑑・立体での描画が例外なし', !err, err);
  assert('会ったbuddyが図鑑に記録される', Object.keys(buddyMet).length >= 8);
}


// ---- 81) ヌメリンの体が線に当たるとミス ----
buddiesOn = false;
{
  for (const md of ['PLANE', 'SPHERE']) {
    settings.mode = md; startGame(); stTimer = 2; tickMeta(0.016); player.invuln = 0; held.fast = true;
    if (md === 'PLANE') steps(0, -1, 30); else { for (let i = 0; i < 8; i++) stepK(0); }
    const tc = trail[trail.length - 3], q = qixes[0];
    if (md === 'PLANE') { q.x = (tc % GW) + 1.5; q.y = ((tc / GW) | 0) + 0.5; q.segs = [{ x1: q.x + 3, y1: q.y - 0.2, x2: q.x + 5, y2: q.y + 0.2, h: 0 }]; }
    else { const nb1 = surf.nb[tc * 4 + 1]; q.p = [surf.dir[nb1 * 3], surf.dir[nb1 * 3 + 1], surf.dir[nb1 * 3 + 2]]; q.segs = [{ pts: [q.p] }]; }
    q.segT = 1; q.spd = 0; deathTimer = 0;
    updateQix(q, 0.001);
    assert(md + ': ヌメリンの体が線に触れるとミス', deathTimer > 0);
  }
  // 平面: 触手が斜めに細い線をまたいでも見逃さない
  settings.mode = 'PLANE'; startGame(); stTimer = 2; tickMeta(0.016); player.invuln = 0; held.fast = true; steps(0, -1, 40);
  let missed = 0;
  for (let a = 0; a < 40; a++) {
    const tc = trail[20], x = (tc % GW) + 0.5, y = ((tc / GW) | 0) + 0.5, ang = a / 40 * Math.PI;
    if (Math.abs(Math.cos(ang)) < 0.2) continue;        // 線とほぼ平行な向きは除く
    const sg = { x1: x - Math.cos(ang) * 11 + 0.37, y1: y - Math.sin(ang) * 11, x2: x + Math.cos(ang) * 11 + 0.37, y2: y + Math.sin(ang) * 11 };
    let hit = false; surf.segEach(sg, c => { if (grid[c] === TRAIL) hit = true; return hit; });
    if (!hit) missed++;
  }
  assert('触手が細い線をすり抜けない', missed === 0, missed);
}
buddiesOn = true;


// ---- 82) セリフとキャラクター設定 ----
{
  const bad = [];
  for (const k in BUDDIES) {
    const B = BUDDIES[k];
    if (!B.nick || !RARITY[B.rar] || !B.bio || !B.lines || !B.lines.hello || !B.lines.idle) bad.push(k + ':設定');
    if (!Array.isArray(B.st) || B.st.length !== 5 || B.st.some(v => !(v >= 0 && v <= 100))) bad.push(k + ':ステータス');
    if (B.role === 'ally' && !(B.lines.bye && B.lines.bye.length)) bad.push(k + ':bye');
    if (['eater', 'squirt', 'thief', 'block', 'dragon'].includes(B.role) && !(B.lines.act && B.lines.act.length)) bad.push(k + ':act');
  }
  assert('18種すべてに名前・レア度・性格・5ステータス・セリフ', bad.length === 0, bad.join(','));
  const tw = BUDDIES.turtle;
  assert('カメはワーブル(カードのステータスそのまま)', tw.nick === 'ワーブル' && tw.st.join() === '6,23,10,33,61');
  // 場面のセリフ・レア・時事ネタ
  assert('場面のセリフ', CLAWD_LINES.claimB.includes(pickLine('claimB', null, 0.9).txt));
  const rr = pickLine('claimB', null, 0.01);
  assert('レアなセリフ(約4%)', rr.rare && RARE_LINES.includes(rr.txt));
  assert('時事ネタ: クリスマス・正月・金曜の夕方・深夜',
    dateLines(new Date(2026, 11, 25, 20)).some(x => x.includes('クリスマス')) && dateLines(new Date(2027, 0, 2, 10)).some(x => x.includes('あけまして'))
    && dateLines(new Date(2026, 8, 25, 18)).some(x => x.includes('金曜')) && dateLines(new Date(2026, 8, 24, 2)).some(x => x.includes('寝なくて')));
  assert('{name}の差し込み', pickLine('meet', { name: 'ガーコ' }, 0.9).txt.includes('ガーコ'));
  // 性格が動きに効く
  settings.mode = 'PLANE'; startGame(); setState('play'); buddies = [];
  const cap = spawnBuddy('capybara'), rab = spawnBuddy('rabbit'), goo = spawnBuddy('goose'), sna = spawnBuddy('snail');
  assert('PATIENCEが高いほどゆっくり(カピバラ<ウサギ)', cap.spdK < rab.spdK);
  assert('CHAOSが高いほどいたずらの間隔が短い(ガチョウ<カタツムリ)', goo.cdK < sna.cdK);
  // buddy がしゃべる
  buddyTalkCD = 0; assert('buddyがしゃべる', buddySay(sna, 'act') && sna.sayT > 0 && BUDDIES.snail.lines.act.includes(sna.sayTxt));
  // 色違い: ごほうび2倍
  buddies = []; const d = spawnBuddy('duck'); d.shiny = true; const s0 = score; rescue(d, { x: 100, y: 100 });
  assert('色違いのアヒルはごほうび2倍', score - s0 === 4000, score - s0);
  // 図鑑のカード
  for (const k in BUDDIES) buddyMet[k] = 'x';
  let err = null;
  try { setState('dex'); dexSel = 0; onKeyDown({ key: 'ArrowRight', preventDefault() {} }); onKeyDown({ key: 'z', preventDefault() {} }); render();
        for (let i = 0; i < 18; i++) { dexSel = i; render(); } onKeyDown({ key: 'x', preventDefault() {} }); }
  catch (e) { err = e.stack; }
  assert('図鑑のカード(全18種)が描ける・操作できる', !err && state === 'dex' && dexSel === 17, err || state + dexSel);
}


// ---- 83) 短い線では導火線に火がつかない(自機のすぐそばに火が出ない) ----
{
  settings.mode = 'PLANE'; startGame(); setState('play'); qixes = []; sparxList = []; seekers = []; buddies = [];
  fuseReset(); player.drawing = true; trail = [0, 1, 2];
  for (let i = 0; i < 120; i++) updateFuse(1 / 60, false);
  assert('3マスの線では点火しない', !fuse.lit);
  // 線は長くても、書き始めが自機のすぐそばなら点火しない(平面1マス=5px)
  trail = Array.from({ length: 40 }, (_, i) => i); player.c = GW;
  for (let i = 0; i < 60; i++) updateFuse(1 / 60, false);
  assert('書き始めが画面上で近いと点火しない', !fuse.lit);
  trail = Array.from({ length: 40 }, (_, i) => i); player.c = 60;
  for (let i = 0; i < 60; i++) updateFuse(1 / 60, false);
  assert('書き始めが離れていれば点火する', fuse.lit);
  fuseReset(); player.drawing = false; trail = [];
}


// ---- 84) コンティニューするとスコアは0から(ハイスコアは残る) ----
{
  settings.mode = 'PLANE'; startGame(); score = 123456; saveHi(); setState('over'); stTimer = 0;
  continueGame();
  assert('コンティニューでスコア0', score === 0 && hiScore >= 123456, score + ' / ' + hiScore);
}


// ---- 85) いろいろな色のインク・虹・アイテム ----
{
  settings.mode = 'PLANE'; settings.ink = 'MIX'; settings.theme = THEMES.length; startGame(); setState('play');
  qixes = []; sparxList = []; seekers = []; buddies = []; items = [];
  assert('平面は INK テーマ', inkMode());
  const seen = new Set();
  for (let i = 0; i < 40; i++) { nextInk(); seen.add(ink.i); }
  assert('MIX: いろいろな色になる', seen.size >= 8, seen.size);
  const a = ink.i; nextInk(); assert('続けて同じ色にならない', ink.i !== a);
  let ok = true;
  for (let i = 0; i < 200; i++) { const pr = ink.recent.slice(); const p0 = ink.i; nextInk(); if (pr.includes(ink.i) || hueGap(INK_COLORS[ink.i], INK_COLORS[p0]) < 45) ok = false; }
  assert('直前3色は使わず、色相も離れる', ok);
  // ローラー・描きかけの線・塗った陣地は同じ色(速い線でも)
  held.fast = false;
  let m = steps(0, -1, 3); player.usedFast = true;
  assert('ローラー=線=塗る色(速い線も)', trailHex(true) === inkHex() && trailHex(false) === inkHex() && palHex(inkNo(1)) === inkHex());
  const want = INK_BASE + ink.i;
  // 本当に線を閉じて、塗られた色がローラーの色と同じか
  settings.mode = 'PLANE'; startGame(); setState('play'); qixes = qixes.slice(0, 1); items = [];
  qixes[0].x = GW / 2; qixes[0].y = GH / 2; sparxes = []; seekers = [];
  const rollerCol = inkHex();
  held.fast = false; steps(0, -1, 6); steps(1, 0, 6); steps(0, 1, 6);
  const got = new Set(); for (let c = 0; c < surf.N; c++) if (grid[c] === WALL && colA[c] >= INK_BASE) got.add(palHex(colA[c]));
  assert('囲んだ陣地はローラーと同じ色', got.size === 1 && got.has(rollerCol), [...got].join() + ' / ' + rollerCol);
  assert('次の線は別の色になる', inkHex() !== rollerCol);
  assert('塗る色番号 = いまのインク', inkNo(1) === INK_BASE + ink.i && palHex(inkNo(1)) === INK_COLORS[ink.i]);
  assert('ローラーの色 = いまのインク', inkHex() === INK_COLORS[ink.i]);
  starT = 5; assert('STAR中は金のインク', palHex(inkNo(1)) === '#ffcc33'); starT = 0;
  // 虹: セルごとに帯の色
  ink.rainbowT = 5;
  assert('虹のときは -1(セルごと)', inkNo(1) === -1);
  const bins = new Set(); for (let c = 0; c < surf.N; c += 13) bins.add(colFor(c, -1));
  assert('虹: いくつもの色の帯になる', bins.size >= 6 && [...bins].every(v => v >= RB_BASE && v < RB_BASE + RB_N), bins.size);
  ink.rainbowT = 0;
  // 固定色(ネット対戦用の「自分の色」)
  settings.ink = 'CYAN'; for (let i = 0; i < 5; i++) nextInk();
  assert('固定色: いつも同じ色', ink.i === INK_FIXED.CYAN);
  settings.ink = 'RAINBOW'; assert('RAINBOW設定: いつも虹', inkNo(1) === -1);
  settings.ink = 'MIX';
  // 描画(平面・立体)が例外なし
  let err = null;
  try {
    for (let c = 0; c < 400; c++) if (grid[c] === OPEN) { grid[c] = WALL; colA[c] = c % 2 ? INK_BASE + 3 : RB_BASE + (c % RB_N); }
    redrawField(); render();
    settings.mode = 'CUBE'; startGame(); setState('play');
    for (let c = 0; c < surf.N; c += 3) if (grid[c] === OPEN) { grid[c] = WALL; colA[c] = c % 2 ? INK_BASE + 5 : RB_BASE + (c % RB_N); }
    ink.rainbowT = 3; buildColors(); render(); ink.rainbowT = 0;
  } catch (e) { err = e.stack; }
  assert('インク・虹の描画(平面・立体)が例外なし', !err, err);
  // 新アイテム
  settings.mode = 'PLANE'; startGame(); setState('play'); qixes = []; items = [];
  const oc = surf.nb[player.c * 4 + 0] >= 0 && grid[surf.nb[player.c * 4 + 0]] === OPEN ? surf.nb[player.c * 4 + 0] : null;
  const c0 = idx(GW >> 1, GH >> 1);
  items.push({ c: c0, k: 'rainbow', t: 0 }); grid[c0] = WALL; collectItems();
  assert('RAINBOWアイテムで虹インク', ink.rainbowT > 0);
  const before = claimed, c1 = idx(20, 20);
  items.push({ c: c1, k: 'splash', t: 0 }); grid[c1] = WALL; collectItems();
  assert('SPLASHアイテムでまわりが塗られる', claimed > before, claimed - before);
  ink.rainbowT = 0; const i0 = ink.i, c2 = idx(60, 30);
  items.push({ c: c2, k: 'paint', t: 0 }); grid[c2] = WALL; collectItems();
  assert('PAINTアイテムでインクの色が変わる', ink.i !== i0);
}


// ---- 86) ミスの原因が出る・方向キーを押している間は導火線が燃えない ----
{
  settings.mode = 'PLANE'; startGame(); setState('play'); player.invuln = 0; deathTimer = 0;
  floats.length = 0; death('テスト');
  assert('ミスの原因を表示', lastDeath === 'テスト' && floats.some(f => f.txt === 'ミス: テスト'));
  deathTimer = 0; player.invuln = 0;
  fuseReset(); player.drawing = true; trail = Array.from({ length: 60 }, (_, i) => i); player.c = 70;
  for (let i = 0; i < 120; i++) updateFuse(1 / 60, true);   // 押しているが進めない
  assert('方向キーを押している間は点火しない', !fuse.lit);
  fuseReset(); player.drawing = false; trail = [];
}


// ---- 87) 塗りの模様(時間・面積・アイテム・コンボ) ----
{
  const run = (setup) => {
    settings.mode = 'PLANE'; settings.ink = 'MIX'; startGame(); setState('play');
    qixes = qixes.slice(0, 1); qixes[0].x = GW * 0.8; qixes[0].y = GH * 0.8; sparxes = []; seekers = []; items = []; buddies = [];
    setup();
    held.fast = false; steps(0, -1, 14); steps(1, 0, 14); steps(0, 1, 14);
    const ms = new Set(); let n = 0;
    for (let c = 0; c < surf.N; c++) if (grid[c] === WALL && colA[c] >= INK_BASE) { n++; ms.add(mixA[c]); }
    return { n, ms };
  };
  assert('pickPattern: STAR=水玉 / COMBO=ストライプ / SLOW=波 / じっくり=うずまき / 大きい=波紋',
    (() => { starT = 1; const a = pickPattern({ drawTime: 0, pct: 1 }); starT = 0; combo = 1; const b = pickPattern({ drawTime: 0, pct: 1 }); combo = 3; const b2 = pickPattern({ drawTime: 0, pct: 1 }); combo = 0;
             slowT = 1; const c = pickPattern({ drawTime: 0, pct: 1 }); slowT = 0;
             return a === 'dots' && b === 'stripe' && b2 === 'check' && c === 'wave' && pickPattern({ drawTime: 6, pct: 1 }) === 'swirl'
               && pickPattern({ drawTime: 0, pct: 30 }) === 'ripple' && pickPattern({ drawTime: 0, pct: 1 }) === 'grad'; })());
  const g = run(() => {});
  assert('ふつうに塗るとグラデーション(混ぜ具合が何段階もある)', g.n > 50 && g.ms.size >= 4, g.n + ' / ' + [...g.ms]);
  const st = run(() => { starT = 10; });
  let gold = 0; for (let c = 0; c < surf.N; c++) if (mixA[c] && palHex(col2A[c]) === '#ffcc33') gold++;
  assert('STAR中は金の水玉', gold > 3, gold); starT = 0;
  const sp = run(() => { combo = 2; comboT = 5; });
  assert('コンボ中はストライプ(2段: 地と縞)', sp.ms.size === 2, [...sp.ms]); combo = 0;
  // 描画(平面・立体)
  let err = null;
  try {
    redrawField(); render();
    settings.mode = 'CUBE'; startGame(); setState('play');
    const cells = []; for (let c = 0; c < surf.N; c += 2) if (grid[c] === OPEN) { grid[c] = WALL; colA[c] = INK_BASE + 2; cells.push(c); }
    waveFrom = cells[0]; applyPattern(cells, 'check'); applyPattern(cells.slice(0, 200), 'dots'); render();
  } catch (e) { err = e.stack; }
  assert('模様の描画(平面・立体)が例外なし', !err, err);
  assert('立体の混ぜ色の枠が作られる', mixSlotKeys.length > 0 && mixSlotKeys.length <= MIX_SLOTS);
}


// ---- 88) 球 = 地球の地図 / 線の色 / 曲 ----
{
  settings.mode = 'SPHERE'; startGame(); setState('play');
  assert('球は地球モード', earthMode() && earthRot);
  const g = earthGrid();
  let landN = 0; for (const v of g) if (v >= 6) landN++;
  assert('地図データ: 陸は3〜4割', landN / g.length > 0.25 && landN / g.length < 0.45, (landN / g.length).toFixed(2));
  // HOME(日本)は地図の色になっている
  let home = 0; for (let c = 0; c < surf.N; c++) if (colA[c] >= EARTH_BASE) home++;
  assert('HOME も地図で塗られる', home > 0 && ![...colA].includes(HOME_COL));
  // 日本の中心(HOME)は陸、その少し東(太平洋)は海
  const hc = [...colA].findIndex((a, c) => a >= EARTH_BASE && lineNeighbors(c).length >= 0 && a - EARTH_BASE >= 6);
  assert('HOME のあたりに陸がある', hc >= 0);
  // 塗ると地図の色
  const cs = []; for (let c = 0; c < surf.N && cs.length < 200; c += 7) if (grid[c] === OPEN) cs.push(c);
  for (const c of cs) { grid[c] = WALL; colA[c] = colFor(c, inkNo(1)); }
  const kinds = new Set(cs.map(c => colA[c] - EARTH_BASE));
  assert('塗ると地図の色(海も陸も)', cs.every(c => colA[c] >= EARTH_BASE) && [...kinds].some(k => k < 5) && [...kinds].some(k => k >= 6), [...kinds]);
  let err = null; try { render(); } catch (e) { err = e.stack; }
  assert('地球の描画が例外なし', !err, err);
  // 線: となりの陣地の色がにじむ
  settings.mode = 'PLANE'; startGame(); setState('play');
  const x0 = 20, y0 = 20;
  for (let y = y0; y < y0 + 10; y++) for (let x = x0; x < x0 + 21; x++) { const c = idx(x, y); grid[c] = WALL; colA[c] = x < x0 + 10 ? INK_BASE + 0 : x > x0 + 10 ? INK_BASE + 2 : 0; }
  const mid = idx(x0 + 10, y0 + 5);
  assert('陣地のあいだの線は、となりの2色', lineNeighbors(mid).length === 2 && lineHex(mid, x0 + 10, y0 + 5) !== null);
  err = null; try { redrawField(); } catch (e) { err = e.stack; }
  assert('線の色つきの焼き込みが例外なし', !err, err);
  // 曲
  assert('アースの曲がある', BGMDATA.earth && BGMDATA.earth.tracks.every(tr => tr.t !== 'n' || tr.s.length === 64) && CONFIG.SURF.SPHERE.music === 'earth');
}


// ---- 89) 塗る音のいろいろ ----
{
  assert('塗る音は6種類', Snd.claimVoices.join() === 'classic,arp,shepard,harp,bell,stab');
  settings.claimSnd = 'HARP'; assert('固定: HARP', Snd.pickClaimSnd() === 'harp');
  settings.claimSnd = 'MIX'; combo = 2; assert('MIX: コンボ中は無限音階', Snd.pickClaimSnd() === 'shepard'); combo = 0;
  const seen = new Set(); for (let i = 0; i < 60; i++) seen.add(Snd.pickClaimSnd());
  assert('MIX: いろいろ鳴る', seen.size >= 5, [...seen]);
  let err = null; try { for (const k of CLAIM_SND_OPTS) { settings.claimSnd = k; Snd.claim(800, true, 'dots'); } } catch (e) { err = e.stack; }
  assert('どの塗る音でも例外なし(音声なし環境)', !err, err);
  settings.claimSnd = 'MIX';
  assert('OPTIONSに「塗る音」', OPT_ITEMS.some(it => it.k === 'claimSnd'));
}


// ---- 90) 立体でもヌメリンの腕が線をすり抜けない ----
for (const mode of ['SPHERE', 'CUBE', 'TORUS', 'KLEIN']) {
  settings.mode = mode; startGame(); setState('play');
  const q = qixes[0], sg = surf.qixArm(q, 0.7, surf.def.arm);
  // 腕の上を細かくたどったマスが、どれも segEach で調べられている
  const P = sg.pts, cells = new Set();
  for (let i = 0; i + 1 < P.length; i++) for (let s2 = 0; s2 < 2; s2++) {
    const t2 = s2 / 2, a = P[i], b = P[i + 1];
    const pt = a.map((v, j) => v + (b[j] - v) * t2);
    if (Math.abs(b[0] - a[0]) > 1 || Math.abs(b[1] - a[1]) > 1) continue;   // 貼り合わせの継ぎ目はとばす
    cells.add(surf.ptCell(pt.length === 3 ? vnorm(pt) : pt));   // 球の上の点は球面へ戻す(直線で結ぶと内側にずれる)
  }
  const seen = new Set(); surf.segEach(sg, c => { seen.add(c); return false; });
  const miss = [...cells].filter(c => !seen.has(c));
  assert(mode + ': 腕の上のマスは判定される(角の先をかすめる2マスまでは許す)', miss.length <= 2, miss.length + '/' + cells.size);
  // 腕の途中に1マスだけ線を置く → ミス
  const mid = [...cells].filter(c => seen.has(c))[Math.floor(cells.size * 0.3)];
  if (grid[mid] === OPEN) {
    player.invuln = 0; deathTimer = 0; q.segs = [sg]; grid[mid] = TRAIL; trail = [mid]; player.drawing = true;
    let hit = false; surf.segEach(sg, c => { if (grid[c] === TRAIL) hit = true; return hit; });
    assert(mode + ': 腕の途中の線に当たる', hit);
    grid[mid] = OPEN; trail = []; player.drawing = false;
  }
}


// ---- 91) アナログスティック ----
{
  const R = 88;
  assert('スティック: 真ん中は止まる', stickDir(5, -8, null, R) === null);
  assert('スティック: 上下左右', stickDir(0, -50, null, R) === 'up' && stickDir(0, 50, null, R) === 'down' && stickDir(-50, 5, null, R) === 'left' && stickDir(50, -5, null, R) === 'right');
  assert('スティック: 斜めの境目ではいまの向きを保つ', stickDir(40, -44, 'right', R) === 'right' && stickDir(44, -40, 'up', R) === 'up');
  settings.mode = 'PLANE'; startGame(); setState('play');
  stickSet('left'); assert('スティックで方向キーが押される', currentDir() === 'left');
  stickSet('up'); assert('向きを変えると前の向きは離される', currentDir() === 'up' && !held.left);
  stickSet(null); assert('指を離すと止まる', currentDir() === null);
  setState('options'); optSel = 0; stickSet('down'); stickSet(null);
  assert('メニューではスティックで選べる', optSel === 1);
  setState('title');
}


// ---- 92) 地球の大陸・ギャラリー・クリアの見せ場 ----
{
  assert('大陸の判定', continentOf(36, 138) === 0 && continentOf(48, 2) === 1 && continentOf(0, 20) === 2 && continentOf(40, -100) === 3
    && continentOf(-15, -60) === 4 && continentOf(-25, 135) === 5 && continentOf(-80, 0) === 6 && continentOf(72, -40) === 3 && continentOf(24, 45) === 0);
  settings.mode = 'SPHERE'; startGame(); setState('play');
  const land = [];
  for (let c = 0; c < surf.N; c++) if (grid[c] === OPEN && earthIdx(c) >= 6) land.push(c);
  const f = discoverContinents(land);
  assert('陸を囲むと大陸を発見', f.length >= 5, f.map(i => CONTINENTS[i]).join());
  assert('同じ大陸は2回知らせない', discoverContinents(land).length === 0);
  let err = null; try { render(); } catch (e) { err = e.stack; }
  assert('大気の光つきの描画が例外なし', !err, err);
  // ギャラリー(シムでは画像が作れないので、入っている体で表示と操作を確かめる)
  gallery = [{ img: 'data:image/jpeg;base64,AA', s: 'PLANE', p: 72.5, d: '2026-09-25', sc: 1234 }, { img: 'data:image/jpeg;base64,BB', s: 'SPHERE', p: 80, d: '2026-09-25', sc: 99 }];
  backToTitle();
  onKeyDown({ key: 'g', preventDefault() {} });
  assert('タイトルでGを押すとギャラリー', state === 'gallery');
  onKeyDown({ key: 'ArrowRight', preventDefault() {} }); onKeyDown({ key: 'z', preventDefault() {} });
  err = null; try { render(); } catch (e) { err = e.stack; }
  assert('ギャラリーを選んで大きく表示', !err && gallerySel === 1 && galleryBig, err);
  onKeyDown({ key: 'x', preventDefault() {} }); onKeyDown({ key: 'x', preventDefault() {} });
  assert('Xで閉じてタイトルへ', state === 'title');
  assert('captureArt は画像が作れない環境でも落ちない', captureArt() === false);
  gallery = [];
  // クリアの見せ場: はじめは結果の板を出さない
  settings.mode = 'PLANE'; startGame(); setState('play'); startClear(false);
  err = null; try { stTimer = 0.3; render(); stTimer = 1.5; render(); } catch (e) { err = e.stack; }
  assert('クリアの見せ場の描画が例外なし', !err, err);
}


// ---- 93) 自由移動(平面) ----
{
  settings.mode = 'PLANE'; startGame(); setState('play'); buddies = []; sparxes = []; seekers = []; items = [];
  qixes = qixes.slice(0, 1); qixes[0].x = GW * 0.8; qixes[0].y = GH * 0.3;
  for (const k of ['up', 'down', 'left', 'right']) releaseDir(k);
  assert('斜めの入力は正規化される', (() => { pressDir('up'); pressDir('right'); const v = inputVec(); releaseDir('up'); releaseDir('right'); return Math.abs(Math.hypot(v[0], v[1]) - 1) < 1e-9 && v[0] > 0 && v[1] < 0; })());
  const x0 = player.fx, y0 = player.fy;
  pressDir('up'); pressDir('right');
  for (let i = 0; i < 40; i++) update(1 / 60);
  assert('斜めにすすんで線を引く', player.drawing && player.fx > x0 + 1 && player.fy < y0 - 1, player.fx.toFixed(1) + ',' + player.fy.toFixed(1));
  let conn = true;
  for (let i = 1; i < trail.length; i++) if (nbIndex(trail[i - 1], trail[i]) < 0) conn = false;
  assert('斜めでも線は上下左右につながっている', conn && trail.length > 5);
  releaseDir('right'); pressDir('left');                // 左上へ
  for (let i = 0; i < 40; i++) update(1 / 60);
  releaseDir('up'); pressDir('down');                    // 左下へ → 下の壁に戻って閉じる
  for (let i = 0; i < 200 && player.drawing; i++) update(1 / 60);
  for (const k of ['up', 'down', 'left', 'right']) releaseDir(k);
  assert('斜めの線で囲んで陣地が取れる', !player.drawing && claimed > 20, claimed);
  assert('線の上に戻っている', isBoundary(player.c));
  stickVec = [0.6, -0.8];
  assert('スティックのアナログの向きがそのまま使われる', inputVec()[0] === 0.6);
  stickVec = null;
}
// ---- 94) ナワバリバトル(CPU) ----
{
  settings.mode = 'VS'; startGame(); setState('play'); buddies = []; sparxes = []; seekers = []; items = [];
  assert('VS: CPUは3人・全員別の色・制限時間', rivals.length === 3 && new Set(rivals.map(r => r.team).concat([0])).size === 4 && vsT === CONFIG.VS_TIME && qixes.length === 1);
  const r = rivals[0];
  assert('CPUは線の上から始まる', isBoundary(r.c));
  // CPU が陣地を取る
  let t0 = rivalAreaSum();
  for (let i = 0; i < 60 * 25 && state === 'play'; i++) { blinkT += 1 / 60; update(1 / 60); if (deathTimer > 0) while (deathTimer > 0) update(1 / 60); }
  assert('CPUが自分で陣地を取る', rivalAreaSum() > t0, rivalAreaSum());
  assert('自機とCPUと中立の陣地の合計 = 全体', playerArea() + rivalAreaSum() + neutralArea() === claimed, playerArea() + '+' + rivalAreaSum() + '+' + neutralArea() + ' vs ' + claimed);
  // CPU が自機の線を切る
  startGame(); setState('play'); player.invuln = 0; deathTimer = 0;
  const rr = rivals[0];
  player.drawing = true; const tc = idx(40, 60); grid[tc] = TRAIL; trail = [tc];
  rr.drawing = true; rivalStep(rr, tc);
  assert('CPUが自機の線に触れると自機のミス', deathTimer > 0 && lastDeath.includes('線を切られた'), lastDeath);
  deathTimer = 0; grid[tc] = OPEN; trail = []; player.drawing = false; rr.drawing = false; rr.trail = [];
  // 自機が CPU の線を切る
  rr.c = idx(50, 70); rr.drawing = true; const rc = idx(51, 70); grid[rc] = RTRAIL; rr.trail = [rc]; rr.pts = [[50.5, 70.5]];
  player.drawing = true; player.c = idx(52, 70); trail = [player.c]; grid[player.c] = TRAIL;
  playerStep(rc);
  assert('自機がCPUの線に触れるとCPUがダウン', rr.dead > 0 && grid[rc] !== RTRAIL);
  // 勝ち負け
  const fakeArea = (me, cpu, cpu2) => { cpu2 = cpu2 || 0; let a = 0, b2 = 0, b3 = 0; for (let i = 0; i < surf.N; i++) { if (grid[i] !== OPEN) continue; if (a < me) { grid[i] = WALL; ownA[i] = 1; a++; } else if (b2 < cpu) { grid[i] = WALL; ownA[i] = 2; b2++; } else if (b3 < cpu2) { grid[i] = WALL; ownA[i] = 3; b3++; } } claimed = me + cpu + cpu2; recountAreas(); };
  startGame(); setState('play'); fakeArea(40, 10);
  vsEnd(); assert('いちばん広ければ勝ち(自機40 > CPU10)', state === 'vsres' && vsWin);
  startGame(); setState('play'); fakeArea(40, 30, 30);
  vsEnd(); assert('CPUの合計より小さくても、1位なら勝ち(40 > 30, 30)', state === 'vsres' && vsWin);
  startGame(); setState('play'); fakeArea(10, 60); const lv0 = lives;
  vsEnd(); assert('せまいと負け', state === 'vsres' && !vsWin);
  let err = null; try { render(); } catch (e) { err = e.stack; } assert('負け画面の描画', !err, err);
  stTimer = 2; onAction(); assert('負けたら残機を1つ使ってやり直し', lives === lv0 - 1 && state === 'ready');
  err = null; try { setState('play'); render(); } catch (e) { err = e.stack; } assert('VSの描画(CPU・バー)', !err, err);
  assert('VSの自機は赤チーム(赤系で揺らぐ)', inkHex() === TEAM_SHADES[0][0] && TEAM_SHADES[0].includes(palHex(inkNo(1))));
  assert('VSのCPUは2ラウンドごとに増えて7人まで', vsCpuCount(1) === 3 && vsCpuCount(3) === 4 && vsCpuCount(20) === 7);
  { const pairs = new Set(); for (let a = 0; a < NT; a++) for (let b = a + 1; b < NT; b++) pairs.add(pairIndex(a, b)); assert('中立の色は28組すべて別', pairs.size === 28 && Math.max(...pairs) === 27); }
}


// ---- 95) PARTY: 3チーム対戦 ----
{
  settings.mode = 'PARTY'; backToTitle();
  onAction(); assert('PARTY: タイトルで決定するとロビー', state === 'lobby');
  lobbyKey('z', true); assert('押しっぱなし(キーリピート)ではスタートしない', state === 'lobby');
  stTimer = 1;
  party.slots = [true, false, false]; party.size = 1; party.sel = 1; lobbyKey('ArrowRight');
  assert('ロビー: 黄を人間に切り替え', party.slots[1] === true);
  party.sel = 2; lobbyKey('z'); assert('ロビー: Zでも切り替え(青=人間)', party.slots[2] === true);
  lobbyKey('z'); assert('もう一度で青=CPU', party.slots[2] === false);
  party.sel = 4; lobbyKey('ArrowRight'); lobbyKey('ArrowRight'); assert('ロビー: CPUの強さを変える', party.cpu !== undefined);
  party.sel = 3; lobbyKey('ArrowRight'); assert('ロビー: 1チームの人数を増やす', party.size === 2); lobbyKey('ArrowLeft');
  party.cpu = 2;
  let err = null; try { render(); } catch (e) { err = e.stack; } assert('ロビーの描画', !err, err);
  // タップ: 青の行をタップすると切り替わる
  const rr = lobbyRects.find(q => q.act === 'slot' && q.i === 2);
  lobbyTap({ x: rr.x + 10, y: rr.y + 10 }); assert('タップで青を人間に', party.slots[2] === true);
  lobbyTap({ x: rr.x + 10, y: rr.y + 10 }); party.sel = 5;
  // タイトルのタップでもロビーへ
  backToTitle(); onAction(); stTimer = 1;
  lobbyKey('z');
  assert('スタートで3チーム(人間2+CPU1)', state === 'ready' && rivals.length === 3 && rivals[0].human === 1 && rivals[1].human === 2 && rivals[2].human === 0);
  { const P = perimeterThirds(), L = 2 * (GW - 1) + 2 * (GH - 1);
    const pos = c => { const x = c % GW, y = (c / GW) | 0; return y === GH - 1 ? (GW >> 1) - x + (x > (GW >> 1) ? L : 0) : x === 0 ? (GW >> 1) + (GH - 1 - y) : y === 0 ? (GW >> 1) + (GH - 1) + x : (GW >> 1) + (GH - 1) + (GW - 1) + y; };
    const d = [pos(P[1]) - pos(P[0]), pos(P[2]) - pos(P[1]), L - (pos(P[2]) - pos(P[0]))];
    assert('スタート地点は外周を3等分(公平)', d.every(v => Math.abs(v - L / 3) <= 2) && P.every(c => isBoundary(c)), d.join()); }
  assert('チームの色は赤・黄・青', rivals.map(r => INK_COLORS[r.col]).join() === [INK_COLORS[6], INK_COLORS[5], INK_COLORS[8]].join());
  setState('play'); sparxes = [];
  // P2 は矢印キーで動く(P1 は動かない)
  const p1 = [rivals[0].fx, rivals[0].fy], p2 = [rivals[1].fx, rivals[1].fy];
  codesDown.add('ArrowDown'); codesDown.add('ArrowRight');
  for (let i = 0; i < 30; i++) update(1 / 60);
  codesDown.clear();
  assert('P2は矢印キーで斜めに動いて線を引く', rivals[1].drawing && rivals[1].fx > p2[0] + 1 && rivals[1].fy > p2[1] + 1);
  assert('P1は動かない', rivals[0].fx === p1[0] && rivals[0].fy === p1[1]);
  // P1 が WASD で P2 の線を切る
  const q = rivals[1], hitCell = q.trail[Math.floor(q.trail.length / 2)];
  const r1 = rivals[0]; r1.c = surf.nb[hitCell * 4 + 3] >= 0 ? surf.nb[hitCell * 4 + 3] : hitCell; r1.drawing = true; r1.trail = [];
  rivalStep(r1, hitCell);
  assert('ほかのチームの線に入ると、その線を切る', q.dead > 0);
  // 人間1人ならどのキーでも
  party.slots = [true, false, false]; codesDown.add('KeyL');
  assert('人間1人ならIJKLでも動ける', humanInput(1).v && humanInput(1).v[0] === 1); codesDown.clear();
  party.slots = [true, true, false];
  // 試合終了と順位
  { let n = [30, 50, 10]; for (let i = 0; i < surf.N; i++) if (grid[i] === OPEN) { for (let t2 = 0; t2 < 3; t2++) if (n[t2] > 0) { grid[i] = WALL; ownA[i] = 2 + t2; n[t2]--; break; } } recountAreas(); }
  partyEnd();
  assert('時間切れで順位(黄=P2が1位)', state === 'partyres' && partyRank[0].team === 1 && partyRank[2].team === 2);
  err = null; try { render(); } catch (e) { err = e.stack; } assert('結果画面の描画', !err, err);
  stTimer = 2; onKeyDown({ key: 'z', preventDefault() {} });
  assert('Zで次のラウンド', state === 'ready' && level === 2 && rivals.length === 3);
  assert('PARTYでは記録を残さない・buddyなし', buddies.length === 0);
  settings.mode = 'VS';
}


// ---- 96) チームの色の揺らぎ・上塗り・中立・ハーモニー ----
{
  const shades = new Set(); for (let i = 0; i < 40; i++) shades.add(palHex(teamNo(2)));
  assert('チームの色は系統の中で揺らぐ(青系4色)', shades.size === 4 && [...shades].every(c => TEAM_SHADES[2].includes(c)));
  assert('中立の色: 赤+青=紫系', NEUTRAL_MIX['02'].includes(palHex(neutralNo(2, 0))));
  settings.mode = 'PARTY'; party.slots = [true, true, true]; startGame(); setState('play'); sparxes = []; items = [];
  // 赤(P1)の陣地を作る
  const R = rivals[0], B = rivals[2];
  const cells = []; for (let y = 60; y < 70; y++) for (let x = 40; x < 60; x++) { const c = idx(x, y); grid[c] = WALL; ownA[c] = 2 + R.id; colA[c] = teamNo(0); cells.push(c); }
  claimed += cells.length; recountAreas();
  const r0 = R.area;
  // 青が上塗りで赤の陣地を走る → 中立
  B.overT = 5; B.c = idx(50, 65); B.fx = 50.5; B.fy = 65.5; B.drawing = false;
  const n1 = overPaint(50.5, 65.5, 2 + B.id, B.team);
  assert('相手の陣地を上塗りすると中立になる', n1 > 0 && neutralArea() === n1 && R.area === r0 - n1);
  assert('中立は2色が混ざった色(赤+青=紫系)', NEUTRAL_MIX['02'].includes(palHex(colA[idx(50, 65)])));
  assert('中立になったばかりは、すぐには自分の色にならない', overPaint(50.5, 65.5, 2 + B.id, B.team) === 0);
  blinkT += 1.5;
  const n2 = overPaint(50.5, 65.5, 2 + B.id, B.team);
  assert('中立をもう一度塗ると自分の陣地', n2 === n1 && neutralArea() === 0 && B.area >= n1 && TEAM_SHADES[2].includes(palHex(colA[idx(50, 65)])));
  assert('全体 = 各チーム + 中立', rivals.reduce((a, r) => a + r.area, 0) + neutralArea() + ownCount[1] + ownCount[0] === claimed);
  // 上塗り中は陣地の上を歩ける
  assert('上塗り中は陣地の上を歩ける', rivalStep(B, idx(51, 65)) && B.c === idx(51, 65));
  B.overT = 0;
  // アイテム: PARTY は上塗りだけ
  let only = true; for (let i = 0; i < 30; i++) if (pickItemKind() !== 'over') only = false;
  assert('PARTYのアイテムは上塗りだけ', only);
  settings.mode = 'TOUR'; let none = true; for (let i = 0; i < 200; i++) if (pickItemKind() === 'over') none = false;
  assert('ひとりのモードに上塗りは出ない', none);
  // 音(音声なし環境でも落ちない)
  settings.mode = 'PARTY'; startGame(); setState('play');
  let err = null; try { rivals[0].drawing = true; updateVoices(); rivals[0].drawing = false; updateVoices(); Snd.voiceStopAll(); } catch (e) { err = e.stack; }
  assert('描く音のハーモニー(音声なし環境で例外なし)', !err, err);
  err = null; try { rivals[1].overT = 3; render(); } catch (e) { err = e.stack; } assert('上塗り中の描画', !err, err);
  settings.mode = 'VS'; party.slots = [true, true, false];
}


// ---- 97) 上塗りアイテムの出やすさ・生き返りの表示 ----
{
  settings.mode = 'PARTY'; party.slots = [true, false, false]; startGame(); setState('play'); items = []; itemTimer = 0;
  updateItems(1 / 60);
  assert('PARTYはすぐ上塗りが出て、6秒ごと', items.length === 1 && items[0].k === 'over' && Math.abs(itemTimer - 6) < 0.1);
  let err = null;
  try { const r = rivals[1]; rivalFail(r, 'qix'); render(); r.dead = 0.001; updateRivals(0.01); render(); } catch (e) { err = e.stack; }
  assert('やられている間の輪・復活の輪の描画', !err && rivals[1].dead === 0 && rivals[1].inv > 0, err);
  settings.mode = 'VS';
}


// ---- 98) 魂の演出・チームの人数 ----
{
  settings.mode = 'PARTY'; party.slots = [true, false, false]; party.size = 5; startGame(); setState('play');
  assert('1チーム5人で15人', rivals.length === 15 && rivals.filter(r => r.team === 0).length === 5 && rivals.filter(r => r.human).length === 1);
  assert('並びは赤・黄・青の交互', rivals.slice(0, 6).map(r => r.team).join() === '0,1,2,0,1,2');
  // 味方の線には入れない
  const a = rivals[0], b = rivals[3];
  b.drawing = true; const bc = idx(40, 80); grid[bc] = RTRAIL; b.trail = [bc];
  a.drawing = true; a.trail = [];
  assert('味方の線は切らない(入れない)', rivalStep(a, bc) === false && b.dead <= 0);
  grid[bc] = OPEN; b.trail = []; b.drawing = false; a.drawing = false;
  // 魂: 昇って、戻ってくる
  const r = rivals[4]; rivalFail(r, 'qix');
  r.dead = CONFIG.RIVAL_RESPAWN * 0.8; const up = soulPos(r);
  r.dead = CONFIG.RIVAL_RESPAWN * 0.3; const back = soulPos(r);
  r.dead = 0.0001; const last = soulPos(r);
  const home = { x: ((r.home % GW) + 0.5) * CS, y: FIELD_Y + (((r.home / GW) | 0) + 0.5) * CS };
  assert('魂はまず上へ昇る', up.up && up.y < r.soul.y);
  assert('復活の前に戻る場所へ着く', !back.up && Math.hypot(last.x - home.x, last.y - home.y) < 3);
  let err = null; try { render(); death('テスト'); render(); } catch (e) { err = e.stack; } assert('魂の描画(ファイター・自機)', !err, err);
  // 15人でも重すぎない(40秒ぶんの更新)
  const t0 = Date.now(); let f = 0;
  for (; f < 60 * 20 && state === 'play'; f++) { blinkT += 1 / 60; update(1 / 60); }
  assert('15人でも1フレーム2ms未満(更新)', (Date.now() - t0) / Math.max(1, f) < 2, ((Date.now() - t0) / f).toFixed(2));
  party.size = 1; settings.mode = 'VS';
}


// ---- 99) 立体の対戦・画面分割 ----
{
  settings.mode = 'PARTY'; party.slots = [true, true, false]; party.size = 2;
  startGame(); level = 2; initLevel(2); setState('play');
  assert('ラウンド2は立体(立方体)', surf.is3D && surf.key === CONFIG.TOUR[1]);
  assert('立体でも6人・全員が線の上から', rivals.length === 6 && rivals.every(r => isBoundary(r.c)));
  const homes = [0, 1, 2].map(t => rivals.find(r => r.team === t).home);
  assert('3チームの基地は離れている', cellDist(homes[0], homes[1]) > 8 && cellDist(homes[1], homes[2]) > 8 && cellDist(homes[0], homes[2]) > 8);
  // 人間2人 → 2画面
  assert('人間2人なら画面を2つに分ける', splitHumans().length === 2);
  let err = null; try { for (let i = 0; i < 30; i++) { blinkT += 1 / 60; tickMeta(1 / 60); update(1 / 60); } render(); } catch (e) { err = e.stack; }
  assert('分割画面の描画・カメラ', !err && paneCams[1] && paneCams[2], err);
  // P2 が矢印で動いて線を引く(P2 の画面のカメラで向きを決める)
  const p2 = rivals.find(r => r.human === 2), c0 = p2.c;
  const pc = camOfHuman(p2);
  const opens = [0, 1, 2, 3].map(k2 => surf.nb[p2.c * 4 + k2]).filter(n => n >= 0 && grid[n] === OPEN);
  const tgt = opens[0], a = withCam(pc, () => surf.screenOf(p2.c)), b = withCam(pc, () => surf.screenOf(tgt));
  const v = [b.x - a.x, b.y - a.y], lv = Math.hypot(v[0], v[1]);
  codesDown.clear();
  codesDown.add(v[1] < -Math.abs(v[0]) ? 'ArrowUp' : v[1] > Math.abs(v[0]) ? 'ArrowDown' : v[0] < 0 ? 'ArrowLeft' : 'ArrowRight');
  for (let i = 0; i < 40 && state === 'play'; i++) { blinkT += 1 / 60; update(1 / 60); }
  codesDown.clear();
  assert('P2は自分の画面の向きで動いて線を引く', p2.c !== c0 && (p2.drawing || p2.dead > 0 || isBoundary(p2.c)));
  // CPU だけの立体の試合が進む
  party.slots = [false, false, false]; party.size = 1; startGame(); level = 2; initLevel(2); setState('play');
  for (let i = 0; i < 60 * 25 && state === 'play'; i++) { blinkT += 1 / 60; update(1 / 60); }
  assert('立体でもCPUが陣地を取る', rivalAreaSum() > 0);
  // VS の立体
  settings.mode = 'VS'; startGame(); level = 3; initLevel(3); setState('play');
  assert('VSも立体(球)でCPUが出る(全員別の基地)', surf.is3D && rivals.length === vsCpuCount(3) && rivals.every(r => isBoundary(r.c)) && new Set(rivals.map(r => r.home)).size === rivals.length && !earthMode());
  err = null; try { for (let i = 0; i < 60 * 10 && state === 'play'; i++) { blinkT += 1 / 60; update(1 / 60); if (deathTimer > 0) while (deathTimer > 0) update(1 / 60); } render(); } catch (e) { err = e.stack; }
  assert('VSの立体が例外なく進む', !err, err);
  party.slots = [true, true, false]; party.size = 1;
}


// ---- 100) 結果画面・音・対戦の設定・キーコンフィグ・掛け合い・柄 ----
{
  // 結果画面
  settings.mode = 'VS'; settings.vsCpu = 'AUTO'; startGame(); setState('play');
  vsStat.kills = 2; rivals[0].kills = 1; rivals[0].downs = 3;
  vsEnd();
  let err = null; try { stTimer = 0.3; render(); stTimer = 2; render(); } catch (e) { err = e.stack; }
  assert('VSの結果画面(しゅうりょう → 表)', !err && state === 'vsres' && vsResult.rank.some(e => e.me && e.kills === 2), err);
  // 設定: CPUの数・時間・ステージ
  settings.vsCpu = '6'; settings.matchTime = 120; settings.stageSel = 'TORUS';
  startGame(); setState('play');
  assert('設定: CPU6人・120秒・ドーナツ', rivals.length === 6 && vsT === 120 && surf.key === 'TORUS');
  settings.stageSel = 'RANDOM'; startGame();
  assert('設定: ランダムは毎回の並びから', CONFIG.SURF[surf.key] && stageOrder.length === Object.keys(CONFIG.SURF).length);
  settings.vsCpu = 'AUTO'; settings.matchTime = 90; settings.stageSel = 'TOUR';
  backToTitle(); openMatchOpts('options');
  err = null; try { render(); matchSel = MATCH_ITEMS.findIndex(it => it.k === 'matchTime'); matchAdjust(1); render(); } catch (e) { err = e.stack; }
  assert('対戦の設定の画面', !err && state === 'matchopts' && settings.matchTime === 120, err);
  settings.matchTime = 90;
  // キーコンフィグ: P2 の「↑」を KeyT に
  matchSel = MATCH_ITEMS.findIndex(it => it.k === '_keys'); matchAdjust(1); assert('キーコンフィグの画面へ', state === 'keycfg');
  keySel = [1, 0]; keyCfgKey({ key: 'z' }); keyCfgKey({ key: 't', code: 'KeyT' });
  assert('キーを変えられる', PARTY_KEYS[1].u[0] === 'KeyT');
  err = null; try { render(); } catch (e) { err = e.stack; } assert('キーコンフィグの描画', !err, err);
  keyCfgKey({ key: 'r' }); assert('R で元に戻す', PARTY_KEYS[1].u[0] === 'ArrowUp');
  // ひとりで遊ぶとき P1 のキーでも動ける
  PARTY_KEYS[0].u = ['KeyT']; settings.mode = 'PLANE'; startGame(); setState('play');
  codesDown.add('KeyT'); const v = inputVec(); codesDown.clear();
  assert('ひとりでもP1のキーで動ける', v && v[1] < 0);
  PARTY_KEYS[0].u = DEFAULT_KEYS[0].u.slice();
  // 掛け合い
  settings.mode = 'VS'; startGame(); setState('play');
  banterT = 0; updateBanter(0.01);
  const said = rivals.some(r => r.sayT > 0) || speech.t > 0;
  updateBanter(1.0);
  assert('掛け合い: ひとりが言って、だれかが返す', said && banterQ.length === 0);
  // コンボの柄
  const cells = []; for (let y = 40; y < 70; y++) for (let x = 20; x < 60; x++) { const c = idx(x, y); grid[c] = WALL; colA[c] = teamNo(2); cells.push(c); }
  for (const pt of ['ichimatsu', 'asanoha', 'flower']) {
    applyTeamPattern(cells, pt, cells[0]);
    const on = cells.filter(c => mixA[c] > 0).length;
    assert('柄: ' + pt + ' がつく(一部だけ白っぽく)', on > 20 && on < cells.length * 0.8, on + '/' + cells.length);
  }
  assert('コンボ1=市松 2=麻の葉 3=フラワーオブライフ', teamPat(1) === 'ichimatsu' && teamPat(2) === 'asanoha' && teamPat(5) === 'flower' && teamPat(0) === null);
  err = null; try { redrawField(); } catch (e) { err = e.stack; } assert('柄の焼き込み', !err, err);
  // 描く音: 試合の外では止まる
  err = null; try { setState('title'); tickMeta(0.016); } catch (e) { err = e.stack; } assert('試合の外では描く音を止める', !err && Snd.voiceCount === 0, err);
}


// ---- 101) CPUの強さ5段階・上のバーの色ごとの割合 ----
{
  settings.mode = 'VS';
  const sk = CPU_LV.map(l => { settings.cpuLv = l; level = 1; return rivalSkill(); });
  assert('強さは5段階(悪魔がいちばん)', CPU_LV.length === 5 && CPU_LV[4] === '悪魔' && sk.every((v, i) => i === 0 || v > sk[i - 1]) && sk[4] > 1.4);
  assert('悪魔は迷わない(考える時間がとても短い)', (() => { settings.cpuLv = '悪魔'; let m = 0; for (let i = 0; i < 50; i++) m = Math.max(m, thinkTime()); return m < 0.05; })());
  settings.cpuLv = '悪魔'; startGame(); setState('play');
  let err = null; try { for (let i = 0; i < 60 * 15 && state === 'play'; i++) { blinkT += 1 / 60; update(1 / 60); if (deathTimer > 0) while (deathTimer > 0) update(1 / 60); } render(); } catch (e) { err = e.stack; }
  assert('悪魔のCPUで試合が進む・バーの描画', !err, err);
  settings.cpuLv = 'AUTO';
  party.cpu = 4; assert('PARTYでも悪魔を選べる', CPU_LV[party.cpu] === '悪魔'); party.cpu = 1;
}


// ---- 102) ナワバリバトルの準備画面・残機制 ----
{
  settings.mode = 'VS'; settings.vsRule = 'TIME'; backToTitle();
  onAction(); assert('VSを選んで決定すると準備画面', state === 'vssetup');
  stTimer = 1;
  vsSel = 0; vsSetKey('ArrowRight'); assert('準備画面: ステージを変える', settings.stageSel === 'RANDOM');
  vsSetKey('ArrowLeft');
  const vi = k2 => VSSET_ITEMS.findIndex(it => it.k === k2);
  vsSel = vi('vsRule'); vsSetKey('ArrowRight'); assert('準備画面: ルールを残機制に', settings.vsRule === 'STOCK');
  vsSel = vi('_amount'); vsSetKey('ArrowRight'); assert('残機制なら残機の数を変える', settings.vsStock === 4);
  vsSel = vi('vsCpu'); vsSetKey('ArrowRight'); assert('CPUの数', settings.vsCpu === '1');
  vsSel = vi('vsCpu'); for (let i = 0; i < 3; i++) vsSetKey('ArrowRight');   // 1 → 4人
  let err = null; try { render(); } catch (e) { err = e.stack; } assert('準備画面の描画', !err, err);
  vsSel = VSSET_ITEMS.length - 1; vsSetKey('z');
  assert('スタートで残機制の試合(時間なし・CPU4人・みんな残機4)', state === 'ready' && isStock() && rivals.length === 4 && rivals.every(r => r.stock === 4) && lives === 3);
  setState('play'); sparxes = [];
  // CPUを全員脱落させると勝ち
  for (const r of rivals) { for (let i = 0; i < 4; i++) { r.dead = 0; rivalFail(r, 'cut'); } }
  assert('残機がなくなると脱落', rivals.every(r => r.out));
  update(1 / 60);
  assert('全員脱落させたら勝ち', state === 'vsres' && vsResult.win);
  // 自機が脱落すると負け(ゲームオーバーにはならない)
  startGame(); setState('play'); lives = 0; player.invuln = 0; death('テスト'); while (deathTimer > 0) update(1 / 60);
  assert('残機制で自機が脱落すると、その試合の負け', state === 'vsres' && !vsResult.win);
  stTimer = 2; onAction(); assert('負けても同じラウンドをもう一度(ゲームオーバーなし)', state === 'ready' && lives === vsStock() - 1);
  err = null; try { setState('play'); render(); } catch (e) { err = e.stack; } assert('残機制の上のバー', !err, err);
  // 時間制では時間が進む・残機制では進まない
  const t0 = vsT; update(1 / 60); assert('残機制は時間で終わらない', vsT === t0);
  settings.vsRule = 'TIME'; settings.vsStock = 3; settings.vsCpu = 'AUTO'; settings.stageSel = 'TOUR';
}


// ---- 103) ステージの広さ ----
{
  settings.mode = 'VS'; settings.vsRule = 'TIME'; settings.stageSel = 'PLANE';
  const Wbefore = W;
  for (const [sz, gw] of [['S', 100], ['M', 128], ['L', 160], ['XL', 200]]) {
    settings.stageSize = sz; startGame();
    assert('広さ ' + sz + ': 平面は ' + gw + ' マス幅・画面の大きさは同じ', GW === gw && Math.abs(GW * CS - Wbefore) < 0.5 && surf.N === GW * GH && fieldC.width === Math.round(GW * CS));
  }
  settings.stageSize = 'XL'; settings.vsCpu = '7'; startGame(); setState('play');
  let err = null; try { for (let i = 0; i < 60 * 15 && state === 'play'; i++) { blinkT += 1 / 60; update(1 / 60); if (deathTimer > 0) while (deathTimer > 0) update(1 / 60); } render(); redrawField(); } catch (e) { err = e.stack; }
  assert('特大の平面でCPU7人の試合が進む', !err && rivals.length === 7 && rivals.every(r => r.home >= 0 && r.home < surf.N), err);
  // 立体も広くなる
  settings.stageSel = 'CUBE'; settings.stageSize = 'M'; startGame(); const n1 = surf.N;
  settings.stageSize = 'XL'; startGame(); const n2 = surf.N;
  assert('立体も広さでマスが増える(立方体)', n2 > n1 * 1.8, n1 + '→' + n2);
  settings.stageSel = 'KLEIN'; startGame(); setState('play');
  err = null; try { for (let i = 0; i < 60 * 8 && state === 'play'; i++) { blinkT += 1 / 60; update(1 / 60); if (deathTimer > 0) while (deathTimer > 0) update(1 / 60); } render(); } catch (e) { err = e.stack; }
  assert('特大のクラインの壺(裏返りのつなぎも広さに合わせる)', !err, err);
  // AUTO は人数で
  settings.stageSize = 'AUTO'; settings.vsCpu = '3'; assert('AUTO: 4人なら中', stageSizeFor(1) === 'M');
  settings.vsCpu = '6'; assert('AUTO: 7人なら大', stageSizeFor(1) === 'L');
  settings.vsCpu = '7'; assert('AUTO: 8人なら特大', stageSizeFor(1) === 'XL');
  settings.mode = 'TOUR'; assert('ひとりのモードはいつも中', stageSizeFor(1) === 'M');
  settings.mode = 'VS'; settings.vsCpu = 'AUTO'; settings.stageSel = 'TOUR'; settings.stageSize = 'AUTO';
  startGame();
}


// ---- 104) リザルトで立体を観察 ----
{
  settings.mode = 'VS'; settings.stageSel = 'CUBE'; startGame(); setState('play');
  vsEnd();
  assert('リザルトに入る(観察はオフ)', state === 'vsres' && !resHide && resZoom === 4.7);
  stTimer = 2;
  // 矢印で回る
  const R0 = cam.R.slice(); pressDir('left'); for (let i = 0; i < 10; i++) updateCamera(1 / 60); releaseDir('left');
  assert('矢印キーで立体が回る', cam.R.some((v, i) => Math.abs(v - R0[i]) > 1e-3));
  // V で表を隠す
  onKeyDown({ key: 'v', preventDefault() {} }); assert('V で結果の表を隠す', resHide);
  let err = null; try { render(); onKeyDown({ key: 'v', preventDefault() {} }); render(); } catch (e) { err = e.stack; }
  assert('観察中・結果の描画', !err && !resHide, err);
  // 拡大縮小(カメラの距離が近づく)
  resZoom = 3; for (let i = 0; i < 120; i++) updateCamera(1 / 60);
  assert('拡大縮小でカメラが寄る', Math.abs(cam.D - 3) < 0.2, cam.D.toFixed(2));
  // さわっていなければ、ゆっくり自動で回る
  resIdle = 9; const R1 = cam.R.slice(); for (let i = 0; i < 30; i++) updateCamera(1 / 60);
  assert('さわらないと自動で回る', cam.R.some((v, i) => Math.abs(v - R1[i]) > 1e-3));
  settings.stageSel = 'TOUR';
}

console.log(fails === 0 ? '\n=== 全テスト合格 ===' : '\n=== 失敗 ' + fails + ' 件 ===');
process.exit(fails === 0 ? 0 : 1);
