// 获取周围邻居 (保持不变)
function getNeighbors(q, r) {
    const isEven = (r % 2 === 0);
    const dirs = isEven 
        ? [[1,0],[0,1],[-1,1],[-1,0],[-1,-1],[0,-1]] 
        : [[1,0],[1,1],[0,1],[-1,0],[0,-1],[1,-1]];
    return dirs.map(d => ({q: q + d[0], r: r + d[1]}));
}

function getUnitAt(q, r) {
    return GameState.units.find(u => u.q === q && u.r === r);
}

// ★★★ 修复重点：实装诺谛卡被动 & 光环计算 ★★★
function getUnitAttack(unit) {
    let atk = unit.stats.atk;
    
    // 1. 诺谛卡被动：血量越低，攻击越高 (最高+100%)
    if (unit.key === 'nordica') {
        const hpLostPct = (unit.maxHp - unit.curHp) / unit.maxHp;
        atk = atk * (1 + hpLostPct); 
        // 加上吞噬获得的永久攻击力
        if (unit.permanentAtkBonus) {
            atk += unit.permanentAtkBonus;
        }
    }

    // 2. 高级马库斯的光环检查
    if (unit.side === 'player') {
        const neighbors = getNeighbors(unit.q, unit.r);
        const hasBuff = neighbors.some(n => {
            const u = getUnitAt(n.q, n.r);
            return u && u.side === 'player' && u.key === 'marcus_high';
        });
        if (hasBuff) atk *= 1.2; // 提升20%
    }
    
    return Math.floor(atk);
}

function calculateValidActions(unit) {
    GameState.validMoves = [];
    GameState.validTargets = [];
    
    let moveRange = unit.stats.move;
    // Lv5 终极马库斯移动+1
    if (unit.key === 'marcus_ultimate' && unit.level >= 5) moveRange += 1;

    // BFS 移动计算
    if (!unit.hasMoved && moveRange > 0) {
        let queue = [{q: unit.q, r: unit.r, dist: 0}];
        // 使用 Set 存储字符串键，防止重复访问
        let visited = new Set([`${unit.q},${unit.r}`]);
        
        while(queue.length > 0) {
            let curr = queue.shift();
            if (curr.dist < moveRange) {
                getNeighbors(curr.q, curr.r).forEach(n => {
                    // 边界检查：必须在地图内
                    const tile = GameState.map.find(t => t.col === n.q && t.row === n.r);
                    if (!tile) return;

                    const key = `${n.q},${n.r}`;
                    const occupier = getUnitAt(n.q, n.r);
                    
                    // 只有没访问过 且 (没单位 或者 单位是自己) 才能通过
                    // 注意：战棋通常不能穿过敌人，这里简化为不能穿过任何单位
                    if (!visited.has(key) && !occupier) {
                        visited.add(key);
                        GameState.validMoves.push({q: n.q, r: n.r});
                        queue.push({q: n.q, r: n.r, dist: curr.dist + 1});
                    }
                });
            }
        }
    }
    
    // 攻击范围计算
    if (!unit.hasAttacked) {
        let atkRange = unit.stats.range;
        if (unit.key === 'marcus_ultimate' && unit.level >= 5) atkRange += 1;

        GameState.units.forEach(target => {
            if (target !== unit && target.side !== unit.side) {
                if (dist(unit, target) <= atkRange) {
                    GameState.validTargets.push({q: target.q, r: target.r});
                }
            }
        });
    }
}

// ★★★ 优化重点：更精准的六边形距离公式 (Axial Distance) ★★★
function dist(u1, u2) {
    // 将 Offset 坐标转换为 Axial 坐标进行准确计算
    // 这里的转换基于 "Odd-r" 布局 (根据 getNeighbors 推断)
    function offsetToAxial(q, r) {
        var x = q - (r - (r&1)) / 2;
        var z = r;
        var y = -x-z;
        return {x, y, z};
    }
    
    const a = offsetToAxial(u1.q, u1.r);
    const b = offsetToAxial(u2.q, u2.r);
    
    return (Math.abs(a.x - b.x) + Math.abs(a.y - b.y) + Math.abs(a.z - b.z)) / 2;
}

// 简单的平滑移动动画
function smoothMove(unit, tq, tr, callback) {
    if (GameState.isAnim) return;
    GameState.isAnim = true;
    
    // 立即更新逻辑坐标，防止动画期间被选中
    unit.q = tq; 
    unit.r = tr;
    
    const targetPix = getHexPixel(tq, tr);
    const startX = unit.curX; 
    const startY = unit.curY;
    let progress = 0;
    
    const animate = () => {
        progress += 0.08; // 移动速度
        if (progress >= 1) {
            unit.curX = targetPix.x;
            unit.curY = targetPix.y;
            GameState.isAnim = false;
            if (callback) callback();
        } else {
            // Ease-out 缓动，让移动更有质感
            const ease = 1 - Math.pow(1 - progress, 3);
            unit.curX = startX + (targetPix.x - startX) * ease;
            unit.curY = startY + (targetPix.y - startY) * ease;
            requestAnimationFrame(animate);
        }
    };
    animate();
}

function gainXp(unit, amount) {
    if (unit.level >= CONFIG.maxLevel) return;
    
    unit.xp += amount;
    const reqXp = unit.level * 100;
    
    if (unit.xp >= reqXp) {
        unit.level++;
        unit.xp -= reqXp;
        
        // 升级奖励
        unit.maxHp += 50;
        unit.curHp = unit.maxHp; // 升级回满血
        unit.stats.atk += 20;
        
        // ★★★ 视觉优化：使用 'true' 触发 Q弹放大动画，颜色使用亮蓝色 ★★★
        Renderer.addFloatingText(`Lv.${unit.level} UP!`, unit.q, unit.r, '#2979ff', true);
        Renderer.spawnParticles(unit.curX, unit.curY, '#2979ff'); // 升级同时也放个粒子
    }
}

function checkEncirclement(unit) {
    const ns = getNeighbors(unit.q, unit.r);
    let enemyCount = 0;
    const flags = [];
    
    for (let i = 0; i < 6; i++) {
        const n = ns[i];
        const u = getUnitAt(n.q, n.r);
        const hasEnemy = (u && u.side !== unit.side);
        flags.push(hasEnemy);
        if (hasEnemy) enemyCount++;
    }
    
    // 6面包围：绝境
    if (enemyCount === 6) return 2;
    
    // 对角线包围 (夹击)：Index 0-3, 1-4, 2-5
    if ((flags[0] && flags[3]) || (flags[1] && flags[4]) || (flags[2] && flags[5])) return 1;
    
    return 0;
}