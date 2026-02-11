function getHexPixel(col, row) {
    const w = Math.sqrt(3) * CONFIG.hexSize;
    const h = 2 * CONFIG.hexSize;
    return { x: w * (col + 0.5 * (row & 1)), y: h * 0.75 * row };
}

function pixelToHex(x, y) {
    // 反向计算，考虑视口偏移和缩放
    x = (x - Viewport.x) / Viewport.scale;
    y = (y - Viewport.y) / Viewport.scale;
    
    let best = null, minD = 9999;
    
    // 简单遍历查找（对于10x12地图，性能完全OK）
    GameState.map.forEach(t => {
        const p = getHexPixel(t.col, t.row);
        const d = Math.hypot(x - p.x, y - p.y);
        if (d < minD) {
            minD = d;
            best = t;
        }
    });
    
    return (minD < CONFIG.hexSize) ? {q: best.col, r: best.row} : null;
}

function dist(u1, u2) {
    const dx = Math.abs(u1.q - u2.q);
    const dy = Math.abs(u1.r - u2.r);
    return Math.max(dx, dy + Math.floor((dx - (u1.r%2 - u2.r%2)) / 2));
}

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

function toRoman(num) {
    const romans = ["", "I", "II", "III", "IV", "V"];
    return romans[num] || num;
}