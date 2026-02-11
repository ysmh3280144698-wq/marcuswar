// ★★★ 修改点1：在此处定义诺谛卡，价格改为 18000 ★★★
if (typeof UNIT_TYPES !== 'undefined') {
    Object.assign(UNIT_TYPES, {
        nordica: { 
            name: "诺谛卡", img: "nordica.png", 
            hp: 5000, atk: 600, def: 50, move: 5, range: 5, 
            cost: 18000, // <--- 价格已修改
            desc: "血量越低攻击越高，击杀永久加攻, Lv10攻击两次，Lv20地母加护。", actionsPerTurn: 1, crit: 0.2
        },
        war_track: { 
            name: "战争履带", img: "war_track.png", 
            hp: 15000, atk: 400, def: 80, move: 2, range: 2, cost: 0, 
            desc: "BOSS。半血召唤恶魔。", actionsPerTurn: 2 
        },
        devil: { 
            name: "地狱恶魔", img: "devil.png", 
            hp: 40000, atk: 350, def: 100, move: 10, range: 2, cost: 0, 
            desc: "我方伤害+10%，敌方受伤+10%。", actionsPerTurn: 2 
        }
    });
}

function init() {
    Renderer.init('gameCanvas');
    let loaded = 0;
    
    Object.keys(UNIT_TYPES).forEach(k => { 
        const img = new Image(); 
        const imgName = UNIT_TYPES[k].img || 'infantry.png'; 
        img.src = 'assets/' + imgName; 
        img.onload = () => { loaded++; };
        img.onerror = () => { 
            console.warn(`缺失图片: assets/${imgName}，将跳过加载防止白屏。`);
            loaded++; 
        };
        GameState.assets[k] = img; 
    });

    for(let r=0; r<CONFIG.mapRows; r++) 
        for(let c=0; c<CONFIG.mapCols; c++) 
            GameState.map.push({col:c, row:r, type:0});
    
    const mapWidth = Math.sqrt(3) * CONFIG.hexSize * (CONFIG.mapCols + 0.5);
    const mapHeight = 2 * CONFIG.hexSize * (CONFIG.mapRows * 0.75 + 0.5);
    Viewport.x = (window.innerWidth - mapWidth) / 2 + CONFIG.hexSize; 
    Viewport.y = (window.innerHeight - mapHeight) / 2 + CONFIG.hexSize;

    spawnUnit('foundation', 0, 0, 'player');
    spawnUnit('heinrich', CONFIG.mapCols-1, CONFIG.mapRows-1, 'enemy');
    spawnUnit('armor', CONFIG.mapCols-2, CONFIG.mapRows-2, 'enemy');

    Renderer.preRenderMap();
    bindEvents();
    Renderer.render();
}

function getHexesInRange(centerQ, centerR, range) {
    const results = [];
    for (let q = -range; q <= range; q++) {
        for (let r = Math.max(-range, -q - range); r <= Math.min(range, -q + range); r++) {
            results.push({ q: centerQ + q, r: centerR + r });
        }
    }
    return results;
}

function spawnUnit(key, q, r, side) {
    if (!UNIT_TYPES[key]) {
        console.error(`错误：尝试生成未定义的单位 '${key}'。请检查 UNIT_TYPES。`);
        return;
    }

    const tmpl = UNIT_TYPES[key];
    const pix = getHexPixel(q, r);
    const maxAp = tmpl.actionsPerTurn || 1;
    GameState.units.push({
        key, name: tmpl.name, q, r, side,
        curX: pix.x, curY: pix.y,
        maxHp: tmpl.hp, curHp: tmpl.hp,
        stats: { atk: tmpl.atk, def: tmpl.def, move: tmpl.move, range: tmpl.range || 1, crit: tmpl.crit || 0.1 },
        anim: { shake: 0, teleportAlpha: 1 },
        hasMoved: false, hasAttacked: false,
        actionPoints: maxAp, maxActionPoints: maxAp,
        level: 1, xp: 0,
        status: { panic: 0 },
        permanentAtkBonus: 0
    });
}

function forceSpawnUnit(key, q, r, side) {
    const existing = getUnitAt(q, r);
    if (existing) {
        Renderer.spawnParticles(existing.curX, existing.curY, '#000'); 
        GameState.units = GameState.units.filter(u => u !== existing);
    }
    spawnUnit(key, q, r, side);
    const newUnit = getUnitAt(q, r);
    if (newUnit) {
        Renderer.spawnParticles(newUnit.curX, newUnit.curY, '#ff1744'); 
    }
}

function bindEvents() {
    const canvas = Renderer.canvas;
    canvas.addEventListener('mousedown', e => {
        if(e.button === 1) { 
            e.preventDefault(); Viewport.isDragging = true; Viewport.startX = e.clientX; Viewport.startY = e.clientY; Viewport.lastX = e.clientX; Viewport.lastY = e.clientY;
        }
    });
    window.addEventListener('mousemove', e => {
        if (Viewport.isDragging) {
            Viewport.x += e.clientX - Viewport.lastX; Viewport.y += e.clientY - Viewport.lastY; Viewport.lastX = e.clientX; Viewport.lastY = e.clientY;
        }
        const hex = pixelToHex(e.clientX, e.clientY);
        GameState.hoverHex = hex;
        updateTooltip(e.clientX, e.clientY);
        if (hex && getUnitAt(hex.q, hex.r)) document.body.style.cursor = 'pointer';
        else document.body.style.cursor = 'default';
    });
    window.addEventListener('mouseup', e => {
        if (e.button === 1) Viewport.isDragging = false;
        if (e.button === 0 && !Viewport.isDragging) handleTap(e.clientX, e.clientY);
    });
    canvas.addEventListener('wheel', e => {
        e.preventDefault();
        const delta = e.deltaY > 0 ? -0.1 : 0.1;
        Viewport.scale = Math.min(Math.max(Viewport.scale + delta, 0.5), 2.5);
    }, { passive: false });
    
    document.getElementById('end-turn-btn').onclick = endTurn;
    document.getElementById('close-prod-btn').onclick = closeProduction;
}

function handleTap(x, y) {
    if (GameState.gameOver || !GameState.isPlayerTurn || GameState.isAnim) return;
    const hex = pixelToHex(x, y);
    if (!hex) { deselect(); return; }
    
    // ★★★ 修改点2：已删除“基地升级”判定逻辑 ★★★

    const clickedUnit = getUnitAt(hex.q, hex.r);
    const moveMove = GameState.validMoves.find(m => m.q === hex.q && m.r === hex.r);
    if (moveMove) {
        const u = getUnitAt(GameState.selectedHex.q, GameState.selectedHex.r);
        u.hasMoved = true;
        smoothMove(u, hex.q, hex.r, () => {
            GameState.selectedHex = {q: hex.q, r: hex.r};
            calculateValidActions(u);
        });
        GameState.validMoves = []; GameState.validTargets = [];
        return;
    }

    const attackTarget = GameState.validTargets.find(t => t.q === hex.q && t.r === hex.r);
    if (attackTarget) {
        const attacker = getUnitAt(GameState.selectedHex.q, GameState.selectedHex.r);
        const defender = getUnitAt(hex.q, hex.r);
        combat(attacker, defender);
        return;
    }

    if (clickedUnit && clickedUnit.key === 'foundation' && clickedUnit.side === 'player') {
        GameState.selectedHex = hex;
        GameState.validMoves = []; GameState.validTargets = [];
        openProduction();
        return;
    }

    if (clickedUnit && clickedUnit.side === 'player') {
        GameState.selectedHex = hex;
        calculateValidActions(clickedUnit);
        closeProduction();
        return;
    }
    deselect();
}

function combat(attacker, defender) {
    if (GameState.isAnim) return;
    
    if (attacker.key === 'nordica') {
        attacker.actionPoints--; 
        if (attacker.actionPoints <= 0) {
             attacker.hasAttacked = true; 
             attacker.hasMoved = true;
        }
    } else {
        attacker.hasAttacked = true; attacker.hasMoved = true;
    }
    
    GameState.isAnim = true;

    const isNuke = (attacker.key === 'marcus_ultimate' && attacker.level >= 5);
    const isBossAttack = (attacker.key === 'war_track'); 
    const isCavalryCharge = (attacker.key === 'cavalry' && attacker.hasMoved);
    const isNordicaAOE = (attacker.key === 'nordica' && attacker.level >= 20);

    const startX = attacker.curX; const startY = attacker.curY;
    const targetX = defender.curX; const targetY = defender.curY;
    const dx = targetX - startX; const dy = targetY - startY;

    let progress = 0;
    const animateStrike = () => {
        progress += 0.15;
        if (progress > 1) progress = 1;
        
        if (!isNuke && !isBossAttack && !isNordicaAOE) {
            let p = progress;
            if (p < 0.5) { 
                 attacker.curX = startX + dx * 0.6 * (p * 2);
                 attacker.curY = startY + dy * 0.6 * (p * 2);
            } else {
                 attacker.curX = startX + dx * 0.6 * (1 - (p-0.5)*2);
                 attacker.curY = startY + dy * 0.6 * (1 - (p-0.5)*2);
            }
        }

        if (progress < 1) requestAnimationFrame(animateStrike);
        else {
            attacker.curX = startX; attacker.curY = startY;
            GameState.isAnim = false;
            
            if (isCavalryCharge) {
                defender.status.panic = 2; 
                Renderer.addFloatingText("慌乱!", defender.q, defender.r, '#e040fb');
            }

            if (isNuke) {
                applyDamage(attacker, defender, 2.0);
                getNeighbors(defender.q, defender.r).forEach(n => {
                    const u = getUnitAt(n.q, n.r);
                    if (u && u.side !== attacker.side && u !== defender) applyDamage(attacker, u, 1.0);
                });
                Renderer.spawnParticles(defender.curX, defender.curY, 'nuke');
            } 
            else if (isBossAttack) {
                applyDamage(attacker, defender, 2.0); 
                Renderer.spawnParticles(defender.curX, defender.curY, 'nuke');
                getNeighbors(defender.q, defender.r).forEach(n => {
                    const u = getUnitAt(n.q, n.r);
                    if (u && u !== attacker && u.side === 'player') {
                         applyDamage(attacker, u, 1.0); 
                    }
                });
            } 
            else if (isNordicaAOE) {
                // --- 主目标特效 ---
                // 1. 爆发紫色能量 (代表的魔法伤害)
                Renderer.spawnParticles(defender.curX, defender.curY, '#d500f9'); 
                // 2. 爆发大量血溅 (代表物理重击)
                Renderer.spawnParticles(defender.curX, defender.curY, '#b71c1c'); 
                
                // 造成伤害
                applyDamage(attacker, defender, 1.0);
                
                // --- AOE 范围目标特效 ---
                // 获取周围 2 格范围内的所有格子
                const area = getHexesInRange(defender.q, defender.r, 2);
                
                area.forEach(t => {
                    const u = getUnitAt(t.q, t.r);
                    // 排除掉自己(attacker)、主目标(defender)和友军
                    if (u && u !== defender && u.side !== attacker.side) {
                        
                        // ★★★ 新增：让每一个被波及的敌人都爆出血和紫光 ★★★
                        Renderer.spawnParticles(u.curX, u.curY, '#b71c1c'); // 血溅
                        Renderer.spawnParticles(u.curX, u.curY, '#9c27b0'); // 紫色余波
                        
                        // 稍微延迟一点点伤害飘字，制造一种"冲击波扩散"的感觉
                        setTimeout(() => {
                            applyDamage(attacker, u, 1.0);
                        }, 100); 
                    }
                });
            }
            else {
                applyDamage(attacker, defender, 1.0);
            }

            if (attacker.key === 'nordica' && attacker.actionPoints > 0) {
                calculateValidActions(attacker);
            } else if (attacker.key === 'nordica') {
                deselect();
            }
        }
    };
    animateStrike();
}

function getUnitAttack(u) {
    let base = u.stats.atk;
    
    if (u.key === 'nordica') {
        const hpLossPct = (u.maxHp - u.curHp) / u.maxHp;
        base = base * (1 + hpLossPct);
        base += (u.permanentAtkBonus || 0);
    }
    
    base = base * (1 + 0.1 * (u.level - 1));
    return base;
}

function applyDamage(attacker, defender, multiplier = 1.0) {
    defender.anim.shake = 15;
    
    let critChance = attacker.stats.crit;
    let critDmgMult = 1.5;

    if (attacker.key === 'marcus_super' && attacker.level >= 20) {
        critChance += 1.0; 
        critDmgMult += 2.0; 
    }
    if (attacker.key === 'nordica' && attacker.level >= 20) {
        critChance = 1.0; 
        critDmgMult += 3.0; 
    }

    const isCrit = Math.random() < critChance;
    let rawAtk = getUnitAttack(attacker) * (isCrit ? critDmgMult : 1.0) * multiplier;
    
    if (attacker.status && attacker.status.panic > 0) rawAtk *= 0.7;
    if (defender.status && defender.status.panic > 0) rawAtk *= 1.2;

    const hasDevil = GameState.units.some(u => u.key === 'devil');
    if (hasDevil) {
        if (attacker.side === 'enemy') rawAtk *= 1.10; 
        if (defender.side === 'enemy') rawAtk *= 0.90; 
    }

    if (defender.key === 'nordica' && defender.level >= 20) {
        rawAtk *= 0.5; 
        Renderer.addFloatingText("地母加护", defender.q, defender.r, '#ffd700');
    }

    const flank = checkEncirclement(attacker);
    if (flank > 0) {
        if (flank === 1) { rawAtk *= 0.5; Renderer.addFloatingText("士气低落", attacker.q, attacker.r, '#ff9800'); } 
        else if (flank === 2) { rawAtk *= 0.25; Renderer.addFloatingText("陷入绝境!", attacker.q, attacker.r, '#d32f2f'); }
    }

    let dmg = Math.floor(rawAtk - defender.stats.def);
    if (dmg < 1) dmg = 1;
    defender.curHp -= dmg;
    
    if (attacker.key === 'marcus_super' && attacker.level >= 20) {
        const heal = Math.floor(dmg * 0.05);
        if (heal > 0) {
            attacker.curHp = Math.min(attacker.curHp + heal, attacker.maxHp);
            Renderer.addFloatingText(`+${heal}`, attacker.q, attacker.r, '#00e676');
        }
    }

    if (attacker.side === 'player') gainXp(attacker, dmg);
    
    Renderer.addFloatingText((isCrit ? `!` : ``) + dmg, defender.q, defender.r, isCrit ? '#ff1744' : '#111', isCrit);

    if (defender.key === 'heinrich' && defender.curHp < defender.maxHp * 0.5 && !GameState.heinrichTriggered) {
        GameState.heinrichTriggered = true; GameState.bossSpawnPending = true;
        Renderer.addFloatingText("地面在震动...", defender.q, defender.r, '#d32f2f');
    }
    if (defender.key === 'war_track' && defender.curHp < defender.maxHp * 0.5 && !GameState.warTrackTriggered) {
        GameState.warTrackTriggered = true; GameState.devilSpawnPending = true;
        Renderer.addFloatingText("来自地狱的咆哮!", defender.q, defender.r, '#9c27b0');
    }

    if (defender.curHp <= 0) {
        let pColor = '#333';
        if (defender.side === 'enemy') pColor = '#d32f2f';
        if (defender.key === 'heinrich') pColor = '#5d4037';
        Renderer.spawnParticles(defender.curX, defender.curY, pColor);
        
        GameState.units = GameState.units.filter(u => u !== defender);
        GameState.validTargets = []; GameState.validMoves = [];
        
        if (attacker.side === 'player') {
            GameState.resources += CONFIG.killReward;
            
            if (attacker.key === 'nordica') {
                attacker.permanentAtkBonus += 5;
                Renderer.addFloatingText("吞噬!", attacker.q, attacker.r, '#000');
            }

            if (attacker.key === 'marcus_super') {
                attacker.hasAttacked = false;
                Renderer.addFloatingText("连击!", attacker.q, attacker.r, 'orange', true);
                calculateValidActions(attacker);
            } else if (attacker.key !== 'nordica') { 
                deselect();
            }
        }
        checkWin();
    } else {
        if (!GameState.isAnim && attacker.key !== 'nordica') deselect();
    }
}

function executeDevilSpawn() {
    GameState.devilSpawnPending = false;
    alert("警告：地狱军团已降临！");
    let emptyHexes = [];
    for(let r=0; r<CONFIG.mapRows; r++) for(let c=0; c<CONFIG.mapCols; c++) if (!getUnitAt(c, r)) emptyHexes.push({q:c, r:r});
    if(emptyHexes.length > 0) {
        const spot = emptyHexes[Math.floor(Math.random() * emptyHexes.length)];
        forceSpawnUnit('devil', spot.q, spot.r, 'enemy');
    }
    let candidates = [];
    for(let c=0; c<CONFIG.mapCols; c++) candidates.push({q: c, r: CONFIG.mapRows-1});
    for(let r=0; r<CONFIG.mapRows-1; r++) candidates.push({q: CONFIG.mapCols-1, r: r});
    candidates.sort(() => Math.random() - 0.5);
    let countCar = 5, countCav = 7;
    for (let pos of candidates) {
        if (countCar > 0) { forceSpawnUnit('armored_car', pos.q, pos.r, 'enemy'); countCar--; } 
        else if (countCav > 0) { forceSpawnUnit('cavalry', pos.q, pos.r, 'enemy'); countCav--; } 
        else break;
    }
}

function executeBossSpawn() {
    GameState.bossSpawnPending = false;
    alert("警告：战争的履带 已抵达战场！");
    forceSpawnUnit('war_track', CONFIG.mapCols-1, CONFIG.mapRows-1, 'enemy');
    let candidates = [];
    for(let c=0; c<CONFIG.mapCols-1; c++) candidates.push({q: c, r: CONFIG.mapRows-1});
    for(let r=0; r<CONFIG.mapRows-1; r++) candidates.push({q: CONFIG.mapCols-1, r: r});
    candidates.sort(() => Math.random() - 0.5);
    let countSoldier = 10, countCannon = 4;
    for (let pos of candidates) {
        if (countSoldier > 0) { forceSpawnUnit('soldier', pos.q, pos.r, 'enemy'); countSoldier--; } 
        else if (countCannon > 0) { forceSpawnUnit('cannon', pos.q, pos.r, 'enemy'); countCannon--; } 
        else break;
    }
}

async function teleportUnit(unit, q, r) {
    GameState.isAnim = true;
    for(let i=0; i<=10; i++) { unit.anim.teleportAlpha = 1 - (i/10); await new Promise(res => setTimeout(res, 30)); }
    Renderer.spawnParticles(unit.curX, unit.curY, 'teleport');
    unit.q = q; unit.r = r;
    const pix = getHexPixel(q, r); unit.curX = pix.x; unit.curY = pix.y;
    Renderer.spawnParticles(unit.curX, unit.curY, 'teleport');
    for(let i=0; i<=10; i++) { unit.anim.teleportAlpha = i/10; await new Promise(res => setTimeout(res, 30)); }
    unit.anim.teleportAlpha = 1; GameState.isAnim = false;
}

function endTurn() {
    if (!GameState.isPlayerTurn || GameState.gameOver || GameState.isAnim) return;
    
    GameState.units.filter(u => u.side === 'player' && u.key === 'marcus_high').forEach(healer => {
        const neighbors = getNeighbors(healer.q, healer.r);
        neighbors.forEach(n => {
            const target = getUnitAt(n.q, n.r);
            if (target && target.side === 'player' && target.curHp < target.maxHp) {
                const isCrit = Math.random() < healer.stats.crit;
                const healAmt = Math.floor(getUnitAttack(healer) * (isCrit ? 1.5 : 1.0));
                target.curHp = Math.min(target.curHp + healAmt, target.maxHp);
                Renderer.addFloatingText(`+${healAmt}`, target.q, target.r, '#00e676', isCrit);
                Renderer.spawnParticles(target.curX, target.curY, '#00e676');
            }
        });
    });

    GameState.isPlayerTurn = false;
    document.getElementById('turn-display').innerText = "敌方行动...";
    document.getElementById('end-turn-btn').disabled = true;
    deselect();

    setTimeout(async () => {
        if (GameState.bossSpawnPending) { executeBossSpawn(); await new Promise(r => setTimeout(r, 1000)); }
        if (GameState.devilSpawnPending) { executeDevilSpawn(); await new Promise(r => setTimeout(r, 1000)); }

        const enemies = GameState.units.filter(u => u.side === 'enemy');
        enemies.forEach(u => u.actionPoints = u.maxActionPoints || 1);

        for (let u of enemies) {
            if (!GameState.units.includes(u)) continue;
            if (u.status && u.status.panic > 0) u.status.panic--;

            while (u.actionPoints > 0) {
                const alivePlayers = GameState.units.filter(p => p.side === 'player');
                if (alivePlayers.length === 0) break;

                let target = null, maxScore = -9999;
                alivePlayers.forEach(p => {
                    const d = dist(u, p);
                    let score = -d * 10; 
                    if (p.key === 'marcus_high') score += 50; 
                    if (p.curHp < p.maxHp * 0.3) score += 20; 
                    if (score > maxScore) { maxScore = score; target = p; }
                });

                if (!target) { u.actionPoints = 0; break; }

                if (u.key === 'devil') {
                    let validSpot = null;
                    let attempts = 0;
                    while (!validSpot && attempts < 10) {
                        const rQ = Math.floor(Math.random() * CONFIG.mapCols);
                        const rR = Math.floor(Math.random() * CONFIG.mapRows);
                        if (!getUnitAt(rQ, rR) && dist({q:rQ, r:rR}, target) <= u.stats.range) {
                            validSpot = {q:rQ, r:rR};
                        }
                        attempts++;
                    }
                    if (!validSpot) { 
                        const empty = GameState.map.filter(t => !getUnitAt(t.col, t.row));
                        const rnd = empty[Math.floor(Math.random()*empty.length)];
                        validSpot = {q:rnd.col, r:rnd.row};
                    }

                    if (validSpot) await teleportUnit(u, validSpot.q, validSpot.r);

                    if (dist(u, target) <= u.stats.range) {
                        await new Promise(r => { GameState.isAnim = false; combat(u, target); setTimeout(r, 450); });
                    }
                    u.actionPoints = 0; 
                    continue;
                }

                if (dist(u, target) <= u.stats.range) {
                    await new Promise(r => { GameState.isAnim = false; combat(u, target); setTimeout(r, 450); });
                    u.actionPoints--; 
                } else {
                    const nextStep = getAiStep(u, target);
                    if (nextStep) {
                        await new Promise(r => smoothMove(u, nextStep.q, nextStep.r, r));
                        u.hasMoved = true; 
                        
                        if (dist(u, target) <= u.stats.range) {
                            await new Promise(r => { GameState.isAnim = false; combat(u, target); setTimeout(r, 450); });
                        }
                        u.actionPoints--; 
                    } else {
                        u.actionPoints = 0;
                    }
                }
                await new Promise(r => setTimeout(r, 300));
            }
            u.hasMoved = false; 
            if (u.key === 'heinrich') {
                const type = Math.random() > 0.6 ? 'staff' : 'armor';
                spawnUnitAround(u, type);
            }
        }
        
        GameState.turn++;
        let income = 200;
        GameState.units.forEach(u => {
            if (u.side === 'player' && u.key === 'marcus_normal') income += 50;
            if (u.side === 'player' && u.status && u.status.panic > 0) u.status.panic--;
            
            if (u.key === 'nordica') {
                if (u.level >= 20) u.maxActionPoints = 4;
                else if (u.level >= 10) u.maxActionPoints = 2;
                else u.maxActionPoints = 1;
                u.actionPoints = u.maxActionPoints;
            }
        });
        
        GameState.resources += income;
        Renderer.addFloatingText(`+${income} 💎`, 0, 0, '#00e676'); 

        GameState.isPlayerTurn = true;
        GameState.units.filter(u => u.side === 'player').forEach(u => { u.hasMoved = false; u.hasAttacked = false; });
        document.getElementById('turn-display').innerText = "马库斯的回合";
        document.getElementById('end-turn-btn').disabled = false;
        document.getElementById('res-display').innerText = GameState.resources;
    }, 500);
}

function getAiStep(unit, target) {
    const currentDist = dist(unit, target); const neighbors = getNeighbors(unit.q, unit.r);
    let best = null, bestDist = currentDist;
    for (let n of neighbors) {
        if (!getUnitAt(n.q, n.r) && GameState.map.find(t=>t.col===n.q && t.row===n.r)) {
            const d = dist({q:n.q, r:n.r}, target);
            if (d < bestDist) { bestDist = d; best = n; }
        }
    }
    return best;
}

function spawnUnitAround(centerUnit, key) {
    if (!centerUnit) return; 
    const ns = getNeighbors(centerUnit.q, centerUnit.r);
    ns.sort(() => Math.random() - 0.5);
    for(let n of ns) {
        if(n.q>=0 && n.q<CONFIG.mapCols && n.r>=0 && n.r<CONFIG.mapRows) {
            const onMap = GameState.map.find(t=>t.col===n.q && t.row===n.r);
            const isEmpty = !getUnitAt(n.q, n.r);
            if(onMap && isEmpty) {
                spawnUnit(key, n.q, n.r, centerUnit.side);
                Renderer.spawnParticles(getHexPixel(n.q, n.r).x, getHexPixel(n.q, n.r).y, '#fff'); 
                return;
            }
        }
    }
}

function deselect() { GameState.selectedHex = null; GameState.validMoves = []; GameState.validTargets = []; closeProduction(); }
function closeProduction() { document.getElementById('production-menu').style.display = 'none'; }
function openProduction() {
    const list = document.getElementById('unit-list');
    list.innerHTML = '';
    const baseHex = GameState.selectedHex; 
    
    // ★★★ 修改点3：现在默认包含诺谛卡 ★★★
    let unitsToShow = ['marcus_normal', 'marcus_high', 'marcus_super', 'marcus_ultimate', 'nordica'];

    unitsToShow.forEach(k => {
        if (!UNIT_TYPES[k]) return;

        const u = UNIT_TYPES[k];
        const card = document.createElement('div');
        card.className = 'unit-card';
        if (k === 'nordica') card.style.border = '2px solid gold';
        
        card.innerHTML = `
            <img src="assets/${u.img || 'infantry.png'}" class="card-img">
            <div class="card-name" ${k==='nordica'?'style="color:#ffd700"':''}>${u.name}</div>
            <div class="card-cost">💎 ${u.cost}</div>
            <div style="font-size:10px; color:#888; margin-top:5px; text-align:center;">${(u.desc || '').substring(0, 10)}...</div>
        `;
        card.onclick = () => {
            const baseUnit = getUnitAt(baseHex.q, baseHex.r);
            if (!baseUnit) { alert("基地消失了？"); return; }
            if (GameState.resources >= u.cost) {
                GameState.resources -= u.cost;
                spawnUnitAround(baseUnit, k); 
                closeProduction(); 
                document.getElementById('res-display').innerText = GameState.resources;
            } else { alert("钻石不足"); }
        };
        list.appendChild(card);
    });
    document.getElementById('production-menu').style.display = 'flex';
}

function updateTooltip(cx, cy) {
    const hex = pixelToHex(cx, cy);
    const tt = document.getElementById('tooltip');
    if(hex) {
        const u = getUnitAt(hex.q, hex.r);
        if(u) {
            tt.style.display = 'block'; tt.style.left = (cx+20)+'px'; tt.style.top = (cy+20)+'px';
            document.getElementById('tt-name').innerText = u.name;
            document.getElementById('tt-lvl').innerText = u.level < CONFIG.maxLevel ? `Lv.${u.level}` : `Lv.MAX`;
            document.getElementById('tt-hp').innerText = u.curHp + '/' + u.maxHp;
            
            let finalAtk = Math.floor(getUnitAttack(u));
            let color = 'white';
            if (u.status && u.status.panic > 0) { finalAtk = Math.floor(finalAtk * 0.7); color = '#e040fb'; }
            
            document.getElementById('tt-atk').innerHTML = `<span style="color:${color}">${finalAtk}</span>`;
            
            let range = u.stats.range;
            if (u.key === 'marcus_super' && u.level >= 20) range += 3;
            document.getElementById('tt-move').innerText = u.stats.move + '格 / ' + range + '射程';
            
            let desc = (UNIT_TYPES[u.key] && UNIT_TYPES[u.key].desc) || '';
            if (u.status && u.status.panic > 0) desc = '[慌乱] 攻-30% 受伤+20% \n' + desc;
            document.getElementById('tt-desc').innerText = desc;

            if (u.level < CONFIG.maxLevel) {
                document.getElementById('tt-xp-bg').style.display = 'block';
                const pct = (u.xp / (u.level * 100)) * 100;
                document.getElementById('tt-xp-fill').style.width = pct + '%';
            } else {
                document.getElementById('tt-xp-bg').style.display = 'none';
            }
            return;
        }
    }
    tt.style.display = 'none';
}

function checkWin() {
    if (!GameState.units.find(u => u.side === 'enemy')) {
        GameState.gameOver = true; document.getElementById('winner-text').innerText = "完全胜利"; document.getElementById('game-over').style.display = 'flex';
    }
    if (!GameState.units.find(u => u.side === 'player' && u.key === 'foundation')) {
        GameState.gameOver = true; document.getElementById('winner-text').innerText = "防线崩溃"; document.getElementById('game-over').style.display = 'flex';
    }
}
init();