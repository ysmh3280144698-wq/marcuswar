const Renderer = {
    canvas: null,
    ctx: null,
    mapCacheCanvas: null,
    tempCanvas: null, 
    tempCtx: null,
    time: 0, 

    init(canvasId) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');
        this.mapCacheCanvas = document.createElement('canvas');
        this.tempCanvas = document.createElement('canvas');
        this.tempCtx = this.tempCanvas.getContext('2d');
        this.resize();
        window.addEventListener('resize', () => this.resize());
    },

    resize() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
        this.tempCanvas.width = 400;
        this.tempCanvas.height = 400;
        this.canvas.style.backgroundColor = CONFIG.bgColor; 
        this.preRenderMap();
    },

    preRenderMap() {
        const w = Math.sqrt(3) * CONFIG.hexSize * (CONFIG.mapCols + 1);
        const h = 2 * CONFIG.hexSize * (CONFIG.mapRows + 1) * 0.75;
        this.mapCacheCanvas.width = w;
        this.mapCacheCanvas.height = h;
        const ctx = this.mapCacheCanvas.getContext('2d');

        GameState.map.forEach(tile => {
            const pix = getHexPixel(tile.col, tile.row);
            const progress = (tile.col * 0.5 + tile.row * 0.8) / (CONFIG.mapCols * 0.5 + CONFIG.mapRows * 0.8);
            const color = this.getBiomeColor(progress);
            this.drawHex(ctx, pix.x, pix.y, CONFIG.hexSize - 0.5, color, true);
        });
    },

    getBiomeColor(p) {
        const lerp = (a, b, t) => Math.floor(a + (b - a) * t);
        let c1, c2, t;
        if (p < 0.6) {
            c1 = CONFIG.biome.playerStart;
            c2 = CONFIG.biome.playerEnd;
            t = p / 0.6; 
        } else {
            c1 = CONFIG.biome.enemyStart;
            c2 = CONFIG.biome.enemyEnd;
            t = (p - 0.6) / 0.4;
        }
        const r = lerp(c1[0], c2[0], t);
        const g = lerp(c1[1], c2[1], t);
        const b = lerp(c1[2], c2[2], t);
        return `rgb(${r},${g},${b})`;
    },

    drawHex(ctx, x, y, size, color, fill) {
        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
            const angle = 60 * i + 30;
            const rad = Math.PI / 180 * angle;
            ctx.lineTo(x + size * Math.cos(rad), y + size * Math.sin(rad));
        }
        ctx.closePath();
        if (fill) {
            ctx.fillStyle = color;
            ctx.fill();
        }
    },

    render() {
        this.time += 0.05; 
        const ctx = this.ctx;
        ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        ctx.save();
        ctx.translate(Viewport.x, Viewport.y);
        ctx.scale(Viewport.scale, Viewport.scale);

        ctx.drawImage(this.mapCacheCanvas, 0, 0);

        GameState.validMoves.forEach(m => {
            const pix = getHexPixel(m.q, m.r);
            ctx.beginPath();
            ctx.arc(pix.x, pix.y, CONFIG.hexSize * 0.25, 0, Math.PI*2);
            ctx.fillStyle = 'rgba(0, 230, 118, 0.6)'; ctx.fill();
            ctx.lineWidth = 1; ctx.strokeStyle = 'white'; ctx.stroke();
        });

        const sortedUnits = [...GameState.units].sort((a,b) => a.curY - b.curY);
        
        sortedUnits.forEach(u => {
            let x = u.curX; let y = u.curY;
            if (u.anim.shake > 0) {
                x += (Math.random()-0.5) * u.anim.shake;
                y += (Math.random()-0.5) * u.anim.shake;
                u.anim.shake *= 0.85;
                if (u.anim.shake < 0.5) u.anim.shake = 0;
            }

            const isHover = GameState.hoverHex && GameState.hoverHex.q === u.q && GameState.hoverHex.r === u.r;
            const isSelected = GameState.selectedHex && GameState.selectedHex.q === u.q && GameState.selectedHex.r === u.r;

            ctx.save();
            if (u.anim.teleportAlpha !== undefined) ctx.globalAlpha = u.anim.teleportAlpha;
            
            this.drawUnitWithEffects(ctx, u, x, y, isHover, isSelected);
            this.drawUnitUI(ctx, u, x, y);

            ctx.restore();
        });

        GameState.validTargets.forEach(t => {
            const pix = getHexPixel(t.q, t.r);
            this.drawCrosshair(ctx, pix.x, pix.y);
        });

        this.updateAndDrawParticles(ctx);
        this.updateAndDrawFloatingText(ctx);

        ctx.restore();
        
        // 动画更新逻辑
        if (GameState.selectedHex && getUnitAt(GameState.selectedHex.q, GameState.selectedHex.r)?.key === 'foundation' && GameState.baseLevel === 1) {
            GameState.upgradeBtnAnim += (1 - GameState.upgradeBtnAnim) * 0.2;
        } else {
            GameState.upgradeBtnAnim += (0 - GameState.upgradeBtnAnim) * 0.2;
        }

        requestAnimationFrame(() => this.render());
    },

    drawUnitWithEffects(ctx, u, x, y, isHover, isSelected) {
        const img = GameState.assets[u.key];
        
        let sizeMultiplier = 1.5; 
        if (['war_track', 'devil', 'nordica'].includes(u.key)) {
            sizeMultiplier = 2.8; 
        }

        const size = CONFIG.hexSize * sizeMultiplier;
        if (!img || !img.complete) return;

        const ratio = Math.min(size/img.width, size/img.height);
        const w = img.width * ratio;
        const h = img.height * ratio;

        let scale = 1.0;
        if (isSelected) scale = 1.15;
        else if (isHover) scale = 1.05;
        if (u.hasAttacked && GameState.isAnim) scale = 1.0;

        ctx.save();
        ctx.translate(x, y);
        ctx.scale(scale, scale);

        if (isHover || isSelected) {
            ctx.save();
            ctx.shadowColor = 'white'; ctx.shadowBlur = 0; 
            ctx.globalCompositeOperation = 'destination-over';
            const thick = 3;
            const dirs = [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]];
            ctx.fillStyle = 'white';
            dirs.forEach(d => ctx.drawImage(img, -w/2 + d[0]*thick, -h/2 + d[1]*thick, w, h));
            ctx.restore();
        }

        if (isSelected) {
            this.tempCtx.clearRect(0, 0, 400, 400);
            const cx = 200, cy = 200;
            this.tempCtx.save();
            this.tempCtx.translate(cx, cy);
            this.tempCtx.drawImage(img, -w/2, -h/2, w, h);
            this.tempCtx.globalCompositeOperation = 'source-atop';
            const shinePos = (Math.sin(this.time * 2.5) + 1) / 2 * (w * 2.5) - w;
            const grad = this.tempCtx.createLinearGradient(-w/2 + shinePos, -h/2, -w/2 + shinePos + 50, h/2);
            grad.addColorStop(0, 'rgba(255, 255, 255, 0)');
            grad.addColorStop(0.5, 'rgba(255, 255, 255, 0.7)');
            grad.addColorStop(1, 'rgba(255, 255, 255, 0)');
            this.tempCtx.fillStyle = grad;
            this.tempCtx.fillRect(-w/2, -h/2, w, h);
            this.tempCtx.restore();
            ctx.drawImage(this.tempCanvas, 0, 0, 400, 400, -200, -200, 400, 400);
        } else {
            ctx.drawImage(img, -w/2, -h/2, w, h);
        }
        ctx.restore();
    },

    drawUnitUI(ctx, u, x, y) {
        let uiOffsetTop = 35; 
        let uiOffsetBottom = 30; 
        let panicOffset = 45; 

        if (['war_track', 'devil', 'nordica'].includes(u.key)) {
            uiOffsetTop = 60;    
            uiOffsetBottom = 65; 
            panicOffset = 75;
        }

        if (u.level > 1) {
            ctx.font = 'bold 14px sans-serif'; ctx.textAlign = 'right';
            ctx.fillStyle = '#fff'; ctx.strokeStyle = '#000'; ctx.lineWidth = 3;
            ctx.strokeText(`Lv.${u.level}`, x+30, y-uiOffsetTop); 
            ctx.fillText(`Lv.${u.level}`, x+30, y-uiOffsetTop);
        }

        if (u.status && u.status.panic > 0) {
            ctx.save();
            ctx.translate(x, y - panicOffset); 
            ctx.fillStyle = `rgba(156, 39, 176, ${0.6 + Math.sin(this.time*5)*0.2})`;
            ctx.beginPath(); ctx.arc(-10, 0, 5, 0, Math.PI*2); ctx.fill();
            ctx.beginPath(); ctx.arc(10, 0, 6, 0, Math.PI*2); ctx.fill();
            ctx.beginPath(); ctx.arc(0, -8, 4, 0, Math.PI*2); ctx.fill();
            ctx.font = 'bold 10px sans-serif'; ctx.fillStyle = '#e040fb'; ctx.textAlign = 'center';
            ctx.fillText("PANIC", 0, -15);
            ctx.restore();
        }

        if (u.key === 'marcus_high') {
             ctx.beginPath(); ctx.arc(x, y, 6, 0, Math.PI*2);
             ctx.fillStyle = `rgba(255, 235, 59, ${0.5 + Math.sin(this.time*3)*0.3})`; ctx.fill();
        }
        
        if (u.side === 'player' && (!u.hasMoved && !u.hasAttacked) && GameState.isPlayerTurn && !GameState.gameOver) {
            const alpha = 0.4 + 0.4 * Math.sin(this.time * 0.15); 
            ctx.save();
            
            let dotOffset = 0;
            if (['nordica'].includes(u.key)) dotOffset = 15;

            ctx.translate(x - 20 - dotOffset, y - 30 - dotOffset);
            
            ctx.fillStyle = `rgba(255, 23, 68, ${alpha})`;
            ctx.beginPath();
            ctx.arc(0, 0, 6, 0, Math.PI*2);
            ctx.fill();
            ctx.shadowColor = 'red'; ctx.shadowBlur = 5;
            ctx.beginPath(); ctx.arc(0, 0, 4, 0, Math.PI*2); ctx.fillStyle = `rgba(255, 100, 100, ${alpha+0.2})`; ctx.fill();
            ctx.restore();
        } else if (u.side === 'player' && (!u.hasMoved || !u.hasAttacked)) {
             ctx.beginPath(); ctx.arc(x+25, y-20, 5, 0, Math.PI*2);
             ctx.fillStyle = '#00e676'; ctx.stroke(); ctx.fill();
        }

        const hpW = 36; 
        const hpY = y + uiOffsetBottom; 
        ctx.fillStyle = '#111'; ctx.fillRect(x-hpW/2-1, hpY-1, hpW+2, 6);
        ctx.fillStyle = u.side === 'player' ? '#4caf50' : '#f44336';
        ctx.fillRect(x-hpW/2, hpY, Math.max(0, hpW * (u.curHp/u.maxHp)), 4);
    },

    drawCrosshair(ctx, x, y) {
        ctx.strokeStyle = '#ff1744'; ctx.lineWidth = 3;
        ctx.beginPath();
        const s = 10;
        ctx.moveTo(x-s, y-s); ctx.lineTo(x+s, y+s);
        ctx.moveTo(x+s, y-s); ctx.lineTo(x-s, y+s);
        ctx.stroke();
    },

    spawnParticles(x, y, type) {
        const count = type === 'nuke' ? 60 : (type === 'teleport' ? 30 : 12);
        for(let i=0; i<count; i++) {
            let color;
            let size = Math.random()*6+3;
            let vx = (Math.random()-0.5)*12;
            let vy = (Math.random()-0.5)*12;
            let pType = 'normal';

            if (type === 'nuke') {
                if (Math.random() > 0.7) { 
                    color = `rgb(${220+Math.random()*35}, ${100+Math.random()*150}, 0)`; 
                    pType = 'fire'; size *= 0.8;
                } else { 
                    const gray = 50 + Math.random()*80;
                    color = `rgba(${gray},${gray},${gray}, ${0.4+Math.random()*0.4})`; 
                    pType = 'smoke'; vx *= 0.6; vy *= 0.6; vy -= 1.5; size = 10 + Math.random()*15;
                }
            } else if (type === 'teleport') {
                const isPurple = Math.random() > 0.5;
                color = isPurple ? `rgba(156, 39, 176, ${0.5+Math.random()*0.5})` : `rgba(0,0,0, ${0.5+Math.random()*0.5})`;
                pType = 'smoke'; vx *= 0.3; vy *= 0.3; 
            } else {
                color = type;
            }
            GameState.particles.push({ x, y, vx, vy, size, color, life: 40 + Math.random()*20, type: pType });
        }
    },

    updateAndDrawParticles(ctx) {
        for (let i = GameState.particles.length - 1; i >= 0; i--) {
            let p = GameState.particles[i];
            p.life--; p.x += p.vx; p.y += p.vy; 
            if (p.type === 'normal' || p.type === 'fire') { p.vy += 0.4; p.size *= 0.95; } 
            else if (p.type === 'smoke') { p.vy -= 0.05; p.size += 0.3; p.vx *= 0.95; }
            ctx.fillStyle = p.color;
            ctx.beginPath(); ctx.arc(p.x, p.y, p.size/2, 0, Math.PI*2); ctx.fill();
            if (p.life <= 0) GameState.particles.splice(i, 1);
        }
    },

    addFloatingText(text, q, r, color, isCrit=false) {
        // ★★★ 修改重点：不管是不是暴击，统统 50 帧 ★★★
        const life = 50; 
        
        GameState.floatingTexts.push({
            text, q, r, color, 
            life: life, 
            maxLife: life, 
            isCrit
        });
    },

    updateAndDrawFloatingText(ctx) {
        for (let i = GameState.floatingTexts.length - 1; i >= 0; i--) {
            let t = GameState.floatingTexts[i];
            const pix = getHexPixel(t.q, t.r);
            
            // 进度 0.0 (出生) -> 1.0 (消失)
            const progress = 1 - (t.life / t.maxLife);
            
            let scale = 1.0;
            let alpha = 1.0;
            
            // 阶段 1: 急促变大 (0% -> 15%)
            if (progress < 0.15) {
                const p = progress / 0.15;
                scale = 0.5 + (p * 0.9); // -> 1.4
            } 
            // 阶段 2: 急速回落 (15% -> 25%)
            else if (progress < 0.25) {
                const p = (progress - 0.15) / 0.10;
                scale = 1.4 - (p * 0.4); // -> 1.0
            } 
            // 阶段 3: 正常飘动
            else {
                scale = 1.0;
            }

            // 暴击时整体放大一点，但不影响速度
            if (t.isCrit) scale *= 1.3;

            // 透明度：最后 30% 开始降低
            if (progress > 0.7) {
                alpha = 1 - ((progress - 0.7) / 0.3);
            }

            // 上浮逻辑
            const floatOffset = -40 - (progress * 50);

            ctx.save();
            ctx.globalAlpha = alpha;
            ctx.translate(pix.x, pix.y + floatOffset);
            ctx.scale(scale, scale);

            // 绘制文字
            if (t.isCrit) {
                ctx.font = '900 22px Arial';
                ctx.strokeStyle = '#fff';
                ctx.lineWidth = 3;
            } else {
                ctx.font = 'bold 20px Arial';
                ctx.strokeStyle = 'rgba(255,255,255,0.8)';
                ctx.lineWidth = 3;
            }
            ctx.textAlign = 'center'; 
            ctx.fillStyle = t.color;
            
            ctx.strokeText(t.text, 0, 0); 
            ctx.fillText(t.text, 0, 0);
            
            ctx.restore();
            
            ctx.globalAlpha = 1;
            t.life--;
            if (t.life <= 0) GameState.floatingTexts.splice(i, 1);
        }
    }
};