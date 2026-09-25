# QLAIM 2 ─ ナワバリ陣取りアーケード(QLAIM 1 の続編。1 は hacchake/qlaim のタグ v1)

## このプロジェクトについて
- 依存なしの単一HTMLブラウザゲーム。本体は `index.html` の1ファイルのみ(CSS/JS全部入り)。
- GitHub Pages にそのまま置いて動かす前提。ビルド工程・外部ライブラリは導入しないこと。
- 音はすべて WebAudio で合成(音声ファイルなし)。

## QLAIM 2 の仕組み
- 保存キーは `store` が `qlaim.` → `qlaim2.` に読み替える(1 と同じ github.io なので混ざらないように)
- 自由移動(平面のみ): 自機の位置は `player.fx, fy`(マス単位の小数)。`inputVec()`(キー同時押し or `stickVec`)の向きに `freeMove` で進む。
  マスが変わるときは `tryMoveTo` が playerStep を呼ぶ。斜めは先に越える側のマスを経由して、線が必ず上下左右につながる(塗りつぶしの漏れ防止)。
  壁では軸ごとにすべる。描いた道すじは `player.pts`(描画用)。立体はこれまでどおりマスごと
- VS(`isVS()`): CPU は `rivals`。同じ `freeMove` と `rivalStep` で動く。描きかけの線は grid の `RTRAIL`、陣地は `ownA`(2+CPU番号)と `r.area`。
  自機の陣地 = `claimed - rivalAreaSum()`。`visitedFrom` は描きかけの線(TRAIL/RTRAIL)を通れる(仕切りにしない)。
  AI: `planRival`(自機の線が近ければ切りにいく / 候補を8つ作ってヌメリンから安全で広いものへ / なければ `frontierPath` で歩く)、
  描いている途中で危ない・進めない・14秒超 → `rivalGoHome`(空き地を通って一番近い線へ)。強さは `rivalSkill()`(エリアで上がる)
- PARTY(`isParty()`): 3チーム(赤・黄・青 = `TEAM_COLS`)。全員が `rivals` のファイター(人間は `r.human` = 1〜3、入力は `humanInput(n)`:
  `codesDown`(e.code)+ゲームパッド(つないだ順)+ P1 はスティック/FASTボタン)。ふつうの `player` は invuln=Infinity でお休み・描かない。
  ロビー state 'lobby'(`party.slots` = 赤黄青それぞれ人間か、`party.cpu`、`party.sel` カーソル、`lobbyRects` でタップ。キーリピートと開いて0.25秒以内は無視)。
  スタート地点は `perimeterThirds()`(外周を3等分)。P番号は人間の色の順(`lobbyPNo`)→ 試合 → `partyEnd` → state 'partyres'(順位)→ Z で `nextParty`。
  ファイターは他のファイターの線(RTRAIL)に入るとその線を切る(`rivalFail(q, 'cut', by)`)。記録は残さない。buddy・アイテム・オイカケなし
- チームの色: `TEAM_SHADES`(赤・黄・青 各4段)を `teamNo(team)` でランダムに。colA の `TEAMC_BASE` から(チーム12 + 中立6 = `TEAMC_ALL`)。
  持ち主 `ownA`: 0 最初の壁・未所有 / 1 自機 / 2+番号 ファイター / 9 `OWN_NEUTRAL`。広さは `recountAreas()` が数え直す(`ownCount`、`r.area`)
- 上塗り(アイテム 'over'、`hasRivals()` のときだけ。PARTY はこれだけ出る): `overT` の間は陣地の上も歩け(`canOverWalk`)、`overPaint` が半径2マスを塗る。
  相手 → 中立(`neutralNo` = 2色の混ざった色、`neutralAt` に時刻)、中立 → 自分(中立になって1.2秒たってから)。線(colA 0)と最初の壁は塗らない
- 色の系統は8つ(`TEAM_SHADES`、`teamHex(t)`、`TEAM_JP`)。中立は28組(`pairIndex`、`neutralNo`)。ファイターの色はすべて `teamHex(r.team)`
- VS は全員敵同士: CPU は `vsCpuCount(lv)` 人(3人から2ラウンドごとに+1、7人まで)、チームは 1〜7(自機は0)。平面は `perimeterSplit(n+1)` で自機と等間隔。
  勝ちは自分が1位のとき(`vsRanking()`)。CPU が3人以上なら途中決着は90%
- チームの人数 `party.size`(1〜5、`PARTY_MAX`)。ファイターは赤黄青の順に交互で `perimeterSplit(n)` に並ぶ。`r.team` / `r.member`。味方の線には入れない。順位・バーは `teamArea(t)`。ownA は 255 = 中立(ファイター番号は 2〜)
- 立体の対戦(`surfaceFor` は VS/PARTY も TOUR の順): 基地はヌメリンを出したあと `setupRivals3D` → `carveBases3D`(チーム0 = HOME、ほかは HOME・ヌメリンから一番遠いマスに半径 home×1.3 の基地。ふちは線)。
  立体のファイターは `updateRival3D`(マスごと。人間は `neighborsToward`、CPU は `planRival3D`: 相手の線を切りに / まっすぐ入って曲がる道 / 線の上を歩く、帰りは `rivalGoHome3D`)。
  RTRAIL の持ち主は `rtOwn`。PARTY の途中決着は `matchTarget()` = 90%。対戦モードの球は地図にしない
- 画面分割(立体の PARTY で人間2〜3人): `splitHumans()`、`paneRects(n)`(上下に等分)、人間ごとのカメラ `paneCams`、`withCam(pc, fn)` で一時的に切り替えて描画・追従・操作の向き
- 結果: VS は state 'vsres'(`vsResult`、`drawResultTable`)。勝ちは startClear の得点・記録をしてから vsres に。PARTY は 'partyres' に同じ表と MVP。どちらも最初の1秒は「しゅうりょう!」
- 成績: `r.kills` / `r.downs`、自機は `vsStat`。rivalFail(r, why, by) の by に加算(by なしで VS の cut/trap は自機の手柄)
- 描く音(voice): 低めの音域・4段まで・ローパス。死亡時と試合の外(tickMeta)で止める
- CPU の強さは5段階 `CPU_LV` / `CPU_SKILL`(0.3〜1.6)。1 をこえると: 取りにいく大きさは「つよい」まで、ヌメリンから大きく離れる、いつも速く描く、迷わない(`thinkTime`)、自機の線をすぐ切りにくる
- 対戦の設定 state 'matchopts'(`MATCH_ITEMS`: settings.vsCpu / cpuLv / matchTime / stageSel)。ステージ RANDOM は startGame で `shuffleStages()`
- キーコンフィグ state 'keycfg': `PARTY_KEYS` を書きかえ(`qlaim2.keys` に保存、`DEFAULT_KEYS` に戻す)。ひとり用でも P1 のキーが効く(`p1Dir`、inputVec)
- 掛け合い: `BANTER` の組を `updateBanter` が7〜13秒ごと(返しは0.9秒後、`banterQ`)。`RIVAL_LINES` に respawn / over / lead / behind / idle も
- チームの柄: `teamPat(combo)` → `applyTeamPattern`(市松 6マス / 麻の葉 13間隔の6方向の線 / フラワーオブライフ 半径18の円の三角格子)。白を5割まぜた線。ファイターは `r.combo`
- 魂: `rivalFail` で `r.soul`(やられた位置)、`soulPos(r)` が昇る(前半45%)→ 画面の上から戻る場所へ(後半)。自機のミスは `souls` に昇る魂だけ
- 生き返り: やられている間は戻る場所にたまる輪、戻った直後は半透明にせずチームの色の輪が広がる(点滅なし)
- 描く音のハーモニー: ファイターごとに `Snd.voiceStart(id, team)`。チーム0/1/2 が和音の根音/3度/5度から始まり、線が伸びるほど和音の中を上がる(`voiceHz`)。
  左右は画面の位置。状態が変わるとき `voiceStopAll`
- `isBoundary` は描きかけの線(TRAIL/RTRAIL)も空き地あつかい(他人の線で自分の足場が一時的に「線の外」にならないように)。
  `snapActor` は空き地の中からでも一番近い線を探す
- 勝負: `vsT`(90秒)が0か占領率が目標で `vsEnd`。勝ち → startClear、負け → state 'vslose' → Z で `vsRetry`(残機-1)
- fuzz は VS と、斜め・アナログ入力も試す。不変条件は `claimed === initOpen - 空き地 - 自機の線 - CPUの線`

## オーナーについて
- オーナー(はちや)は自分でコードを書いたり直したりしない。
  変更内容は「何が変わって、遊ぶとどう感じが変わるか」を日本語で簡潔に説明すること。
- ギターを弾くので、BGMの話は音名・コード進行で伝えると通じやすい。

## 変更したら必ず
```
node test/run-tests.js
```
- 全テスト合格を確認してから完了報告する。失敗したら直してから報告。
- 大きく変えたときは `node test/fuzz.js`(ランダム操作で数万フレーム回す)も実行して problems 0 を確認する。
- 新機能を足したら `test/tests.js` にテストも追加する。
- テストはDOMを持たないNode上で動く(`test/shim.js` がcanvas等をスタブ化)。
  ブラウザAPIを新しく使う場合は shim.js にもスタブを足すこと。

## コード構成(index.html 内 <script> の上から順)
1. `SURF3D` / `CONFIG` — 数値バランス。盤面ごとの値は `CONFIG.SURF`(17種)、TOURの順番は `CONFIG.TOUR`
2. `DIFFS` — 難易度 / `MODES` — 盤面モード(TOUR+各盤面、タイトルで←→) / `MUSIC_KEYS` — BGMの選択肢
3. `THEMES` — 配色テーマ6種。`anim` 付き(PRISM/AURORA)は占領色が時間で移ろう(`tickTheme`)
4. `BGMDATA` — BGM譜面7曲(title/play/orbit/chip/drone/ambient/idm)。音名で記述(♭は#)。
   音色パラメータ a/r/det/echo/ed/pr/oj、ドラム blip あり。`at(len,{step:'音名'})` は疎な譜面の略記
   `form` = 曲の構成(セクションの並び。n回数/t移調/alt別メロs2・別リズムp2/mute/drums:false/boost)。
   セクション切替前は自動でスネアのフィル。`ITEMS` — アイテム4種(SLOW/SHIELD/STAR/1UP)
5. `store` / `settings` / `hiScores`(ハイスコアはモード別。v2の値はPLANEへ引継ぎ)
6. `Snd` — 効果音+BGM音源、`Bgm` — 先読みシーケンサ(確率・やまびこ対応)
7. 盤面(サーフェス):
   - `makePlaneSurface` — 平面
   - `makeRadialSurface` — キューブスフィア割り付けのセルを、形 `SHAPES[shape]` の表面へ放射状に貼る
     (多面体・切頂・準正・星型・球)。形は凸な部品(平面の集まり)の和で、`radialOf` が表面までの距離と法線を返す
   - `makeParamSurface` — (u,v)格子を貼り合わせた曲面(ドーナツ・クラインの壺)。`PARAM_SHAPES`
   - `getSurface` でキャッシュ
8. カメラ(`cam`・`camFollow`・`camRotate`): 立体面で自機を画面中央に追い、格子が画面の縦横にそろうよう傾きも補正
9. ゲーム状態・フィールド(`grid`: OPEN/WALL/TRAIL、`colA`: 0=線 1..8=占領色 9=HOME)、`claimFill`、`visitedFrom`
   `claimAt` — 塗りの波(各セルに波が届く時刻。`markClaim`)
10. プレイヤー(`chooseMove`→`playerStep`)・`closeTrail`(QIX分断→即クリア)・導火線(線が `FUSE_MIN` マス未満か、書き始めが自機から `FUSE_MIN_PX` 以内なら点火しない。方向キーを押している間は燃えない)。ミスは `death(原因)` で原因を画面に出す・QIX・SPARX
11. 進行: 状態は title / options / ready / play / pause / clear / over
12. 描画: `render2D` / `render3D`(へこみのある形は奥行きを層に分けて奥から) / `drawBackdrop`(星雲・星)
    `drawTrailGlow` / `drawClawd`(自機のドット絵) / `renderHUD` / `renderOverlay`、入力

## v4 の遊び要素
- アイテム: 空き地に出現し、線で囲む(=占領でセルが空き地でなくなる)と `collectItems` で取得。
- コンボ: `COMBO_TIME` 秒以内に続けて囲むと倍率アップ。STAR 中はさらに2倍。
- SHIELD: `death()` で消費され、`guarded` の間は残機を減らさない(線は消える)。
- 記録: `bestPct`(盤面ごとのクリア時最高占領率, localStorage `qlaim.best`)。
- 裏側ビュー `drawBackView`、効果表示 `drawStatus`、ポーズメニュー `PAUSE_ITEMS`、なぞり操作 `dirFromDrag`。

## v4.1〜 追加分(どこを見ればいいか)
- ゲームパッド: `padKeys` / `pollPad`(押した瞬間に `onKeyDown` を呼ぶ)。キー処理は `onKeyDown` / `onKeyUp` に関数化済み
- 発光: `drawBloom`(縮小→拡大の加算合成)。`perf` / `watchPerf` が重いと自動で切る(設定は保存しない)
- 盤面は23種。曲面は `PARAM_SHAPES`(`border` で縁あり=メビウスの帯、`flipOff` で反転のしかた)。三葉結び目は `trefoilTube`
- ランキング: `ranks` / `addRank` / `qualifies`、名前入力は state 'entry'(`entry`)
- DAILY: `dailyList`(日付のハッシュで3面)、記録キーは `modeKey()`('DAILY:YYYYMMDD')
- チュートリアル: `TUTOR_TEXT` / `tutorAdvance`(settings.tutor で完了)
- スクリーンショット: `saveShot`(Cキー)
- SEEKER: `spawnSeeker` / `stepSeeker` / `updateSeekers` / `crushSeekers`(AREA 4〜)
- 音の反応: `Snd.react`(BGMローパス・効果音パン)、`Snd.sweep`(囲んだ瞬間)、`Bgm.pulse()`(キックの脈動)
- コンティニュー: `canContinue` / `continueGame` / `giveUp`
- 実績: `ACHV` / `unlock` / `checkClearAchv`、一覧は state 'achv'
- 年輪模様: `ringA`(占領時に閉じた場所からの距離の縞)
- タイトルのデモ: `demoT` / `demoLv`(TOUR/DAILYで背景の盤面が巡る)
- BONUS AREA: `isBonus` / `bonusT`(5エリアごと)、`cancelTrail`
- 曲: synth / lofi を追加。`swing` で裏拍を遅らせる
- テスト用スタブ(test/shim.js)に Path2D と measureText を追加済み
- Clawdの色: `CLAWD_SKINS` / `skinsOpen` / `clawdCol`(実績で解除)
- 全体を見る: X(held.slow)を押す間 `updateCamera` がカメラを引く。スマホは「全体」ボタン
- ZEN: `isZen()`(ミス・導火線・SPARX/SEEKER・記録なし)
- あそんだ記録: `stats` / `saveStats` / `favSurface`、画面は state 'stats'
- QIXのリボン: `drawQixRibbons` / `qixEnds`
- OPTIONSはポーズからも開ける(`optsFrom`)
- ワープ入場: 立体面のエリア開始時 `cam.D = 9` から寄る。状態を先に切り替えてから `initLevel` すること
- 花火 `updateFireworks`、効果音のハモり `Bgm.root()`、クリア音 `Snd.clear_(root)`
- スマホ横向きレイアウト: CSS の landscape メディアクエリと `isLandscapeTouch` / `fitCanvas`
- テーマAUTO: `settings.theme === THEMES.length`、`AUTO_THEME` の対応表
- 結果の共有: `resultText` / `shareResult`(ゲームオーバー画面、Sキー)
- QIXの突進: `QIX_DASH_FROM`、各盤面の `qixAim`
- Clawdのひとこと: `say` / `speech` / `drawSpeech`
- 危険の知らせ: `calcDanger` / `drawDangerEdge`(SPARX・SEEKERが近いと「!」と赤いふち)
- TOURの最高到達エリア: `stats.maxArea`
- 最後の1機の鼓動: `heartT` / `Snd.heart`
- アイテムZAP: SPARX一掃・SEEKERの `stun`
- エンディング: `startEnding` / `finishEnding` / `drawEnding`(state 'ending'、TOUR 1周)
- Clawdの色 RAINBOW(col:null は虹色)
- 盤面の豆知識: `SURF_INFO`(READY画面)
- あそびかた: `openHelp` / `closeHelp` / `drawHelp`(state 'help'、タイトルのH・ポーズメニュー)
- ゲームオーバーで R = すぐもう一度
- 振動 `buzz`(settings.shake で ON/OFF)、ニアミス `nearMiss`(`NEAR_MISS_PTS`)、SPARX接近のチリチリ音
- タブ/アプリ切替で自動ポーズ(visibilitychange)、曲名 `SONG_LABEL`(READY画面)、Clawdのきょろきょろ(3秒静止)
- ポーズ画面に盤面・占領率・スコア、ハイスコア更新表示 `startHi`、初めての盤面の表示(stats.plays === 1)
- コンボで効果音が半音ずつ上がる、タイトルのClawdが盤面名を言う

## 操作
- 方向キーで空き地へ進むと、ボタン無しでゆっくり線を引く(×2点)。Z/スペースを押している間だけ速い(×1点)。
- タッチは左下のアナログスティック(`stickDir` / `stickSet`。親指をすべらせた向きに進む。中央18%は停止、斜めの境目はいまの向きを優先)と FAST ボタン。メニューではスティックが矢印キーになる

## 盤面(サーフェス)の考え方
- どの盤面も「セルのグラフ」。ロジックは `surf.nb`(4近傍)と `surf.nb8`(斜め込み)しか見ない。
  - `nb[c*4+k]` の k=0..3 は一周する順で、k と k+2 が向かい合う(=直進)。
- セル番号: 平面 `y*GW+x` / 放射型 `面*n*n + j*n + i` / 曲面 `j*NU + i`。
- QIXの位置表現だけ盤面ごとに違う(平面・曲面: x,y,head / 放射型: 単位ベクトル p と接ベクトル h)。
  盤面側の `qixSpawn/qixMove/qixTurn/qixArm/segEach/qixCell/qixScreen/ptCell/world` で吸収。
- クラインの壺は u の端をまたぐと v が反転する(u=π の (π,v) が (0,π−v) につながる)。両面描画・半透明。
- 立体面の方向キーは「隣の4セルを画面へ投影して押した向きに近いもの」。同じキーを押し続ける間は直進優先。
- 星型の数値: 小星型12面体は芯(正12面体)の外接半径 0.5628、大星型12面体は芯(正20面体)0.4195(先端=1)。

## 見た目の決まり(オーナーの要望)
- **画面をチカチカ・フラッシュさせない。** 点滅(オン/オフの切り替え)、白い閃光、拍に合わせた画面全体の明滅、
  速い色替わりは使わない。目立たせたいときは、ふちどり・大きさ・ゆっくりしたフェードで。
- 平面が「Qixの丸パクリ」に見えないように: 陣地は丸いインクの塗り(`redrawField`)、描く線は太いインクの帯(`drawInkTrail`)、
  Clawd はローラーで塗る(`drawRoller`)。白い四角のドット線には戻さない。
- 敵はキャラクター: QIX=クラゲ「ヌメリン」(`drawNumerin`)、SPARX=火の玉「バチッコ」(`drawSparx`)、
  SEEKER=一つ目スライム「オイカケ」(`drawSeeker`)。既存の有名キャラに似せない。

## buddy たち(v6)
- Claude Code の /buddy の18種が登場(`BUDDIES` / `BUDDY_ORDER`)。エリアごとに2〜3匹(`buddiesFor`)、9エリアで全員
- 役割(role): ally=迷子の味方(囲むと助けて perk) / eater=陣地をかじる(`erode`、最初の壁 `baseA` はかじらない) /
  squirt=タコの墨 / thief=アイテム泥棒 / block=通せんぼ(`buddyBlocks`) / spike・hop・slide・ghost・dragon=線に触れるとミス
- 囲んだとき `catchBuddies`(味方は `rescue`、いたずら組はつかまえる)。カタツムリ・キノコはさわると `shoo`
- 陣地を減らすときも `claimed === initOpen - 空きセル数` を守る(`erode` で claimed--)
- 絵は `drawBuddy`(すべて図形)。図鑑は state 'dex'(タイトルの B、OPTIONS)、会った記録は `buddyMet`
- テストの前半は `buddiesOn = false` にして、ランダムに出る buddy が他の検証を邪魔しないようにしている
- キャラ設定は `BUDDY_PROFILE`(nick / rar / st=[DEBUGGING,PATIENCE,CHAOS,WISDOM,SNARK] / bio / lines)。カメ=ワーブルはオーナーの /buddy カードそのまま
- ステータスが動きに効く: 速さ `spdK = 1.25 - PATIENCE/200`、いたずら間隔 `cdK = 1.3 - CHAOS/166`
- buddy のセリフは `buddySay(b, kind)`(hello/idle/act/bye。`buddyTalkCD` で話が重ならない)。去りぎわは `buddyBye`
- 色違い(1/40、`buddyShiny` に記録)はごほうび2倍。見た目は金の輪と止まったきらめき(点滅しない)
- 図鑑は 'dex'(一覧・カーソル `dexSel`)→ 'dexcard'(★レア度・ステータスのカード)

## インクの色
- colA の番号: 0 線 / 1..8 テーマの色 / 9 HOME / `INK_BASE`(10)〜 インク12色(最後が金) / `RB_BASE`〜 虹12帯。平面は `palHex`、立体は `col3D` の 24 番以降
- `inkMode()` は INK テーマのとき。線を閉じるたびに `nextInk()`(直前3色は使わず、前の色と色相45°以上離す)。ローラー・描きかけの線・塗る色は必ず同じ色(`trailHex` = `inkHex`。速い線でも淡くしない。立体でも暗くしすぎない)
- 虹: `inkNo()` が -1 を返し、`colFor` がセルごとに `rbBin`(帯の向きは毎回ランダム)で色を決める。RAINBOW アイテム(得点1.5倍)か設定 RAINBOW
- 塗りの模様: `pickPattern`(STAR=水玉 > COMBO=ストライプ/3以上チェック > SLOW=波 > 4.5秒以上じっくり=うずまき > 大きく取った=波紋 > グラデーション)。`applyPattern` がセルごとに 2色目 `col2A` と混ぜ具合 `mixA`(0..7、混ぜ率 m/10)を入れる。色は `cellHex`。立体は `mixCi` が混ぜ色の枠(`MIX_SLOTS`)をその場で作る
- `settings.ink`: MIX / RAINBOW / 固定色(`INK_FIXED`)。ネット対戦を作るなら、ここを各プレイヤーの色にする

## 球 = 地球の地図
- SPHERE だけ `earthMode()`。塗ると `colFor` が地図の色(`EARTH_BASE + earthIdx(c)`)を返す。模様・虹・インク色は使わない
- 地図は `EARTH_RLE`(Natural Earth 110m 陸地・湖、パブリックドメインを 180×90 に。種類 a..p + 長さの連長)。`EARTH_PAL` 16色(海の深さ5段・海氷・氷床・ツンドラ・森・草原・砂漠・山…)。地表の種類は緯度と地域の箱で決めた近似
- 大陸: `continentOf(lat, lon)`(7大陸をおおまかな範囲で)。囲んだ陸が3マス以上ではじめての大陸なら「○○を発見!」(`discoverContinents`)。見つけた記録は `qlaim.continents`、全部で実績 world。球のまわりの青い光は `drawAtmosphere`
- `setupEarth` が HOME の中心を日本(北緯36・東経138)に回す回転 `earthRot` を作り、HOME も地図で塗る

## 線の色(となりの陣地の色がにじむ)
- 平面 `lineHex` / 立体 `lineCi`(0.3秒ごとにキャッシュ作り直し)。陣地のあいだの線は両側の色を市松に縫い合わせ、空き地に面した線(歩ける道)はとなりの色を明るくした色

## ギャラリー・クリアの見せ場
- クリアから1秒後に `captureArt`(平面は fieldC、立体は画面の真ん中を 150×150 の JPEG に)。`qlaim.gallery` に最新24枚。state 'gallery'(タイトル G / OPTIONS)
- クリアの最初の1.2秒は結果の板を出さず「できあがり!」だけ(作品を見せる)。そのあと板がふわっと出る
- スティックは向きが変わると `buzz(8)`

## Clawd のセリフ
- `sayLine(場面)` が `CLAWD_LINES[場面]` から選ぶ(直前と同じものは避ける)。約4%で `RARE_LINES`(★つき・金ぶち)
- 時事ネタ: `dateLines(date)` が日付・季節・曜日・時間のセリフを返す(start/idle/clear で約18%)。オフラインなので本物のニュースは取れない。流行りの話題は `TOPICAL_LINES` に書き足す
- 盤面ごとの感想は `SURF_LINES`。待機7秒・長い線・残機0でもひとこと。吹き出しは `drawBubble`(長い文は2行)

## 音楽の仕組み(v5)
- 音の経路: 各音 → (左右パン) → BGMバス → ローパス → コンプレッサー → マスター。リバーブへは `send` で送る
- `Snd.note(..., x)` の x: flt(フィルター開閉)/ vib(ビブラート)/ pn(左右)/ rv(リバーブ)。省略時はシーケンサが決める
- 打楽器: kick / snare / hat / ohat / clap / tom / blip / crash。セクション頭にクラッシュ、変わり目はタムのフィル
- 平面の曲は splash(ファンク)

## 音の仕組み(v7 追加)
- メロディは `padBus` を通り、キックのたびに `Snd.duck`(曲ごとに `pump`)で一瞬引っこむ。上のレイヤーの短い音はピンポンディレイ(`dlIn`、テンポの付点8分)へ少し送る(`x.dl`)
- 描画中の音は無限音階(シェパードトーン): オクターブ違いの三角波6本、真ん中ほど大きく(`shepW`)。線が伸びるほど五音音階で上がり続け、1オクターブ回ると周波数だけ瞬時に戻す
- 塗る音は `CLAIM_VOICES`(classic=もとの音 / arp / shepard=前回の続きから上がる / harp / bell / stab)。OPTIONS「塗る音」(`settings.claimSnd`)、MIX はコンボ中 shepard、ほかは前回と違うものをランダム
- `Snd.claim(cells, slow, pat)`: びちゃっ(`splat`)+和音+模様ごとの飾り(水玉=鐘、ストライプ=刻み、うずまき=上昇、地球=鐘の和音)。`Snd.item(k)` もアイテムごとに違う
- 曲 earth(アース、球): D-Bm-G-A、パッド・アルペジオ(`arp`)・ゆったりドラム

## 設計上の約束
- 占領率の整合: `claimed === initOpen - 空きセル数` を常に保つ(軌跡セルも占領に計上)。
- 状態遷移のうちフレーム依存のものは `tickMeta(dt)` に置く(テストから呼べるように。カメラ更新もここ)。
- AudioContext はユーザー操作後に生成。`Bgm.play()` はAC未生成なら予約だけする。
- テストのプレイヤー操作は `playerMove('up')` など(画面の向き)か、`playerStep(surf.nb[c*4+k])`(格子の向き)。
- テストは全盤面を作って遊ぶので少し時間がかかる(数十秒)。
