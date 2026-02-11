const CONFIG = {
    hexSize: 60,
    mapCols: 10,
    mapRows: 12,
    bgColor: '#222',
    initialResources: 800,
    killReward: 200,
    maxLevel: 20, // ★ 修改：等级上限提升至20
    
    // ★ 新增：基地升级费用
    //baseUpgradeCost: 12000, 
    
    biome: {
        playerStart: [255, 255, 255], 
        playerEnd:   [240, 240, 245], 
        enemyStart:  [180, 180, 180], 
        enemyEnd:    [80, 80, 80]     
    }
};

const UNIT_TYPES = {
    'marcus_normal': { 
        name: '普通马库斯', hp: 120, atk: 45, def: 5, move: 1, range: 1, crit: 0.15, cost: 100, 
        img: 'marcus_normal.png', desc: '【后勤】每回合额外产出 +50 资源。'
    },
    'marcus_high': { 
        name: '高级马库斯', hp: 280, atk: 80, def: 15, move: 2, range: 1, crit: 0.25, cost: 350, 
        img: 'marcus_high.png', desc: '【医疗】回合结束治疗周围友军。' // ★ 描述更新
    },
    'marcus_super': { 
        name: '超级马库斯', hp: 600, atk: 140, def: 30, move: 2, range: 2, crit: 0.35, cost: 700, 
        img: 'marcus_super.png', desc: '【连击】击杀再动。Lv20解锁吸血必定暴击。' 
    },
    'marcus_ultimate': { 
        name: '终极马库斯', hp: 1500, atk: 250, def: 60, move: 3, range: 2, crit: 0.50, cost: 1600, 
        img: 'marcus_ultimate.png', desc: ' Lv5范围攻击。' 
    },
    // ★★★ 新增神将：诺谛卡 ★★★
    'nordica': {
        name: '诺谛卡', hp: 5000, atk: 600, def: 150, move: 3, range: 5, crit: 0.5, cost: 6400,
        img: 'nordica.png', desc: ' 血越少攻越高，杀敌永久加攻。Lv10攻击两次，Lv20地母加护。'
    },

    'foundation': { name: '基金会', hp: 8000, atk: 0, def: 100, move: 0, range: 0, crit: 0, cost: 0, img: 'base.png', isBuilding: true },
    
    'heinrich':   { name: '海因里希', hp: 6000, atk: 180, def: 60, move: 2, range: 2, crit: 0.2, cost: 0, img: 'heinrich.png' },
    'staff':      { name: '法杖', hp: 100, atk: 90, def: 0, move: 2, range: 3, crit: 0.4, cost: 0, img: 'staff.png' },
    'armor':      { name: '铠甲', hp: 500, atk: 55, def: 50, move: 3, range: 1, crit: 0.1, cost: 0, img: 'armor.png' },
    'soldier':    { name: '士兵', hp: 800, atk: 110, def: 40, move: 2, range: 2, crit: 0.2, cost: 0, img: 'soldier.png' },
    'cannon':     { name: '火炮', hp: 350, atk: 220, def: 10, move: 1, range: 4, crit: 0.1, cost: 0, img: 'cannon.png' },
    
    'war_track':  { 
        name: '战争的履带', hp: 15000, atk: 400, def: 80, move: 2, range: 2, crit: 0.3, cost: 0, 
        img: 'war_track.png', desc: '【Boss】每回合造成溅射伤害。' 
    },
    'armored_car': { 
        name: '装甲车', hp: 4500, atk: 220, def: 60, move: 2, range: 2, crit: 0.2, cost: 0, // ★ 修改：HP 6000 -> 4500
        img: 'armored_car.png', desc: '【强袭】每回合可行动2次。', actionsPerTurn: 2 
    },
    'cavalry': { 
        name: '骑兵', hp: 1800, atk: 150, def: 35, move: 4, range: 1, crit: 0.25, cost: 0, 
        img: 'cavalry.png', desc: '【突击】移动后攻击施加[慌乱]。每回合2动。', actionsPerTurn: 2 
    },
    'devil': { 
        name: '恶魔', hp: 40000, atk: 350, def: 100, move: 10, range: 2, crit: 0.4, cost: 0, 
        img: 'devil.png', desc: '【魔王】全图瞬移。在场时强化所有敌军。', isTeleporter: true 
    }
};

const GameState = {
    map: [],
    units: [],
    resources: CONFIG.initialResources,
    turn: 1,
    isPlayerTurn: true,
    selectedHex: null,
    validMoves: [],
    validTargets: [],
    floatingTexts: [],
    gameOver: false,
    isAnim: false,
    hoverHex: null,
    assets: {},
    particles: [],
    
    // 基地状态
    baseLevel: 1, // 1: 普通, 2: 已升级
    upgradeBtnAnim: 0, // 按钮动画缩放值

    heinrichTriggered: false, 
    bossSpawnPending: false,
    warTrackTriggered: false, 
    devilSpawnPending: false
};


const Viewport = { x: 0, y: 0, scale: 1.0, isDragging: false, lastX: 0, lastY: 0, startX: 0, startY: 0 };
