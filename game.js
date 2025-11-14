import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';

const MAP_SIZE = 24;
const PLATEAU_SIZE = 8;
const TILE_WORLD_SIZE = 6;
const HALF_PLATEAU = PLATEAU_SIZE / 2;
const PLATEAU_CENTER = Math.floor(MAP_SIZE / 2);
const PLATEAU_MIN = PLATEAU_CENTER - HALF_PLATEAU;
const PLATEAU_MAX = PLATEAU_MIN + PLATEAU_SIZE - 1;
const RAMP_TILE = { x: PLATEAU_CENTER, y: PLATEAU_MIN - 1 };

const GROUND_HEIGHT = 1.2;
const PATH_HEIGHT = 1.6;
const RAMP_HEIGHT = 3.5;
const PLATEAU_HEIGHT = 6.5;

const ISO_VECTORS = {
    up: new THREE.Vector3(-Math.SQRT1_2, 0, -Math.SQRT1_2),
    down: new THREE.Vector3(Math.SQRT1_2, 0, Math.SQRT1_2),
    left: new THREE.Vector3(-Math.SQRT1_2, 0, Math.SQRT1_2),
    right: new THREE.Vector3(Math.SQRT1_2, 0, -Math.SQRT1_2)
};

const canvas = document.getElementById('threeCanvas');
const goldEl = document.getElementById('gold');
const waveEl = document.getElementById('wave');
const healthEl = document.getElementById('health');
const buildButtons = document.querySelectorAll('.buildBtn');
const cameraButtons = {
    up: document.getElementById('cameraUp'),
    down: document.getElementById('cameraDown'),
    left: document.getElementById('cameraLeft'),
    right: document.getElementById('cameraRight'),
    zoomIn: document.getElementById('cameraZoomIn'),
    zoomOut: document.getElementById('cameraZoomOut')
};

let scene;
let renderer;
let camera;
let cameraPivot;
let clock;
let raycaster;
const pointer = new THREE.Vector2();
const tileMeshes = [];
const tileGroup = new THREE.Group();
let zoomFactor = 1;
const baseCameraOffset = new THREE.Vector3(0, 80, 80);
const colliders = [];
const tempPlayerDirection = new THREE.Vector3();
const playerLookTarget = new THREE.Vector3();

function createArrowProjectileMesh() {
    const group = new THREE.Group();

    const shaftGeometry = new THREE.CylinderGeometry(0.35, 0.35, 6.5, 12, 1, false);
    shaftGeometry.rotateX(Math.PI / 2);
    const shaft = new THREE.Mesh(shaftGeometry, materials.projectileCore);
    shaft.castShadow = true;
    shaft.receiveShadow = false;
    shaft.position.z = 0;

    const tipGeometry = new THREE.ConeGeometry(0.9, 1.8, 16);
    tipGeometry.rotateX(Math.PI / 2);
    const tip = new THREE.Mesh(tipGeometry, materials.projectileTip);
    tip.castShadow = true;
    tip.position.z = 3.4;

    const fletchGeometry = new THREE.BoxGeometry(1.2, 0.2, 1.6);
    const fletchLeft = new THREE.Mesh(fletchGeometry, materials.projectileFletch);
    fletchLeft.position.set(0.5, 0.6, -3.0);
    fletchLeft.rotation.z = THREE.MathUtils.degToRad(18);

    const fletchRight = fletchLeft.clone();
    fletchRight.position.x = -0.5;
    fletchRight.rotation.z = -THREE.MathUtils.degToRad(18);

    group.add(shaft);
    group.add(tip);
    group.add(fletchLeft);
    group.add(fletchRight);

    return group;
}

const materials = {
    grass: new THREE.MeshStandardMaterial({ color: 0x4caf50, roughness: 0.82, metalness: 0.08 }),
    path: new THREE.MeshStandardMaterial({ color: 0x8d6e63, roughness: 0.75, metalness: 0.12 }),
    ramp: new THREE.MeshStandardMaterial({ color: 0xb3936b, roughness: 0.7, metalness: 0.15 }),
    plateau: new THREE.MeshStandardMaterial({ color: 0xcbb09e, roughness: 0.62, metalness: 0.18 }),
    tower: new THREE.MeshStandardMaterial({ color: 0xbfa27a, roughness: 0.48, metalness: 0.22 }),
    wall: new THREE.MeshStandardMaterial({ color: 0x9ea7ba, roughness: 0.55, metalness: 0.25 }),
    player: new THREE.MeshStandardMaterial({ color: 0x4f7dff, roughness: 0.28, metalness: 0.45 }),
    playerHighlight: new THREE.MeshStandardMaterial({ color: 0xffff8d, emissive: 0xfff176, emissiveIntensity: 1.1, roughness: 0.2, metalness: 0.3, transparent: true, opacity: 0.85, side: THREE.DoubleSide }),
    monster: new THREE.MeshStandardMaterial({ color: 0xe24b47, roughness: 0.45, metalness: 0.35 }),
    homeBase: new THREE.MeshStandardMaterial({ color: 0xcd8f41, roughness: 0.52, metalness: 0.24 }),
    projectileCore: new THREE.MeshStandardMaterial({ color: 0xffe57f, emissive: 0xffc400, emissiveIntensity: 1.8, roughness: 0.2, metalness: 0.65 }),
    projectileTip: new THREE.MeshStandardMaterial({ color: 0xff7043, emissive: 0xff6d00, emissiveIntensity: 1.2, roughness: 0.25, metalness: 0.7 }),
    projectileFletch: new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0x8bc34a, emissiveIntensity: 0.8, roughness: 0.3, metalness: 0.4 })
};

const projectileGeometry = new THREE.SphereGeometry(1.1, 18, 18);

const gameState = {
    gold: 500,
    health: 100,
    wave: 1,
    buildMode: null,
    terrain: [],
    towers: [],
    walls: [],
    monsters: [],
    projectiles: [],
    path: [],
    spawnTimer: null,
    nextWaveTimeout: null,
    player: {
        grid: { x: PLATEAU_CENTER, y: PLATEAU_CENTER + 3 },
        world: new THREE.Vector3(),
        target: null,
        mesh: null,
        speed: 12,
        radius: 1.4,
        isPlayer: true
    },
    home: null
};

function init() {
    setupRenderer();
    setupScene();
    createLights();
    generateTerrain();
    createHomeBase();
    createPlayer();
    setupUIListeners();
    setupPointerListeners();
    setupTouchControls();
    updateUI();
    startWave();
    animate();
}

function setupRenderer() {
    renderer = new THREE.WebGLRenderer({ antialias: true, canvas });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    canvas.style.touchAction = 'none';
    clock = new THREE.Clock();
    raycaster = new THREE.Raycaster();
}

function setupScene() {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1f2f46);
    scene.fog = new THREE.Fog(0x294056, 80, 260);

    camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 500);
    cameraPivot = new THREE.Object3D();
    cameraPivot.rotation.y = Math.PI / 4;
    scene.add(cameraPivot);
    cameraPivot.add(camera);
    refreshCameraPosition();

    scene.add(tileGroup);
    window.addEventListener('resize', onWindowResize);
}

function refreshCameraPosition() {
    const offset = baseCameraOffset.clone().multiplyScalar(zoomFactor);
    camera.position.copy(offset);
    camera.lookAt(cameraPivot.position);
}

function createLights() {
    const ambient = new THREE.AmbientLight(0xd7e3ff, 0.85);
    scene.add(ambient);

    const directional = new THREE.DirectionalLight(0xffffff, 1.05);
    directional.position.set(55, 80, 45);
    directional.castShadow = true;
    directional.shadow.mapSize.width = 4096;
    directional.shadow.mapSize.height = 4096;
    directional.shadow.camera.left = -140;
    directional.shadow.camera.right = 140;
    directional.shadow.camera.top = 140;
    directional.shadow.camera.bottom = -140;
    directional.shadow.camera.near = 5;
    directional.shadow.camera.far = 260;
    scene.add(directional);

    const fill = new THREE.HemisphereLight(0xc1d9ff, 0x4d5b6f, 0.55);
    scene.add(fill);
}

function generateTerrain() {
    tileGroup.clear();
    tileMeshes.length = 0;
    gameState.terrain = Array.from({ length: MAP_SIZE }, () => Array(MAP_SIZE).fill(null));

    const pathPoints = buildPathToPlateau();
    gameState.path = pathPoints;
    const pathKeys = new Set(pathPoints.map(({ x, y }) => `${x},${y}`));

    const offset = (MAP_SIZE * TILE_WORLD_SIZE) / 2;

    for (let y = 0; y < MAP_SIZE; y++) {
        for (let x = 0; x < MAP_SIZE; x++) {
            let type = 'grass';
            let walkable = false;
            let height = GROUND_HEIGHT;

            const insidePlateau = x >= PLATEAU_MIN && x <= PLATEAU_MAX && y >= PLATEAU_MIN && y <= PLATEAU_MAX;

            if (x === RAMP_TILE.x && y === RAMP_TILE.y) {
                type = 'ramp';
                walkable = true;
                height = RAMP_HEIGHT;
            } else if (insidePlateau) {
                type = 'plateau';
                walkable = true;
                height = PLATEAU_HEIGHT;
            } else if (pathKeys.has(`${x},${y}`)) {
                type = 'path';
                walkable = true;
                height = PATH_HEIGHT;
            }

            const geometry = new THREE.BoxGeometry(TILE_WORLD_SIZE, height, TILE_WORLD_SIZE);
            const material = materials[type];
            const mesh = new THREE.Mesh(geometry, material);
            mesh.receiveShadow = true;
            mesh.castShadow = false;

            const worldX = x * TILE_WORLD_SIZE - offset + TILE_WORLD_SIZE / 2;
            const worldZ = y * TILE_WORLD_SIZE - offset + TILE_WORLD_SIZE / 2;
            mesh.position.set(worldX, height / 2, worldZ);
            mesh.userData = { x, y };

            tileGroup.add(mesh);
            tileMeshes.push(mesh);

            gameState.terrain[y][x] = {
                x,
                y,
                type,
                height,
                walkable,
                hasPath: pathKeys.has(`${x},${y}`),
                mesh,
                worldX,
                worldZ,
                occupied: false
            };
        }
    }
}

function buildPathToPlateau() {
    const points = [];
    const spawnX = PLATEAU_CENTER;

    for (let y = 0; y <= RAMP_TILE.y; y += 1) {
        points.push({ x: spawnX, y });
    }

    for (let y = RAMP_TILE.y + 1; y <= PLATEAU_CENTER; y += 1) {
        points.push({ x: spawnX, y });
    }

    return points;
}

function createHomeBase() {
    const group = new THREE.Group();
    const baseHeight = 5;
    const baseGeometry = new THREE.BoxGeometry(TILE_WORLD_SIZE * 1.8, baseHeight, TILE_WORLD_SIZE * 1.8);
    const base = new THREE.Mesh(baseGeometry, materials.homeBase.clone());
    base.castShadow = true;
    base.receiveShadow = true;
    base.position.y = baseHeight / 2;

    const roofGeometry = new THREE.ConeGeometry(TILE_WORLD_SIZE * 1.2, baseHeight * 1.3, 4);
    const roof = new THREE.Mesh(roofGeometry, new THREE.MeshStandardMaterial({ color: 0x5c2c06, roughness: 0.5, metalness: 0.22 }));
    roof.castShadow = true;
    roof.position.y = baseHeight + (baseHeight * 0.65);

    group.add(base);
    group.add(roof);

    const pos = gridToWorld(PLATEAU_CENTER, PLATEAU_CENTER, 0);
    group.position.set(pos.x, pos.y, pos.z);

    scene.add(group);
    gameState.home = group;
    colliders.push({ type: 'home', object: group, radius: TILE_WORLD_SIZE * 1.4 });
}

function createPlayer() {
    const playerGroup = new THREE.Group();
    playerGroup.name = 'Hero';

    const bodyGeometry = new THREE.CapsuleGeometry(1.8, 4.0, 16, 24);
    const body = new THREE.Mesh(bodyGeometry, materials.player);
    body.castShadow = true;
    body.receiveShadow = true;
    body.position.y = 3.6;

    const glowGeometry = new THREE.SphereGeometry(1.4, 24, 16);
    const glowMaterial = new THREE.MeshBasicMaterial({ color: 0xb3e5fc, transparent: true, opacity: 0.45 });
    const glow = new THREE.Mesh(glowGeometry, glowMaterial);
    glow.position.y = 4.6;

    const visorGeometry = new THREE.SphereGeometry(1.2, 24, 18);
    const visorMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xb2ebf2, emissiveIntensity: 1.6, roughness: 0.08, metalness: 0.55 });
    const visor = new THREE.Mesh(visorGeometry, visorMaterial);
    visor.position.set(0, 5.2, 1.3);

    const ringGeometry = new THREE.TorusGeometry(2.6, 0.22, 16, 64);
    const ringMaterial = materials.playerHighlight;
    const ring = new THREE.Mesh(ringGeometry, ringMaterial);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.3;
    ring.castShadow = false;
    ring.receiveShadow = false;

    const beaconGeometry = new THREE.CylinderGeometry(0.6, 0.6, 0.6, 12);
    const beaconMaterial = new THREE.MeshPhongMaterial({ color: 0xffff8d, emissive: 0xfff59d, emissiveIntensity: 1.4, shininess: 80 });
    const beacon = new THREE.Mesh(beaconGeometry, beaconMaterial);
    beacon.position.y = 6.9;

    const heroLight = new THREE.PointLight(0x9be7ff, 2.2, 55, 2.0);
    heroLight.position.set(0, 6.5, 0);

    playerGroup.add(ring);
    playerGroup.add(body);
    playerGroup.add(glow);
    playerGroup.add(visor);
    playerGroup.add(beacon);
    playerGroup.add(heroLight);

    const pos = gridToWorld(gameState.player.grid.x, gameState.player.grid.y, 0);
    playerGroup.position.copy(pos);
    playerGroup.position.y += 0.05;

    scene.add(playerGroup);
    gameState.player.mesh = playerGroup;
    gameState.player.world.copy(playerGroup.position);
}

function setupUIListeners() {
    buildButtons.forEach((btn) => {
        btn.addEventListener('click', () => {
            const type = btn.dataset.type;
            if (gameState.buildMode === type) {
                setBuildMode(null);
            } else {
                setBuildMode(type);
            }
        });
    });

    cameraButtons.up.addEventListener('click', () => panCamera('up'));
    cameraButtons.down.addEventListener('click', () => panCamera('down'));
    cameraButtons.left.addEventListener('click', () => panCamera('left'));
    cameraButtons.right.addEventListener('click', () => panCamera('right'));
    cameraButtons.zoomIn.addEventListener('click', () => adjustZoom(0.08));
    cameraButtons.zoomOut.addEventListener('click', () => adjustZoom(-0.08));
}

function setupPointerListeners() {
    const target = renderer.domElement;

    target.addEventListener('contextmenu', (event) => event.preventDefault());

    target.addEventListener('pointerdown', (event) => {
        if (event.pointerType === 'touch') {
            return;
        }
        if (event.button === 2) {
            handleMoveCommand(event.clientX, event.clientY);
        } else if (event.button === 0) {
            if (!handleBuildCommand(event.clientX, event.clientY)) {
                handleMoveCommand(event.clientX, event.clientY);
            }
        }
    });

    target.addEventListener('pointerup', (event) => {
        if (event.pointerType === 'touch') {
            const coords = event.changedTouches && event.changedTouches[0];
            if (!coords) return;
            if (!handleBuildCommand(coords.clientX, coords.clientY)) {
                handleMoveCommand(coords.clientX, coords.clientY);
            }
        }
    });
}

function setupTouchControls() {
    const joystick = document.getElementById('joystick');
    const handle = document.getElementById('joystickHandle');
    if (!joystick || !handle) return;

    let active = false;

    joystick.addEventListener('touchstart', (event) => {
        const touch = event.touches[0];
        if (!touch) return;
        active = true;
        joystick.style.opacity = '1';
    });

    joystick.addEventListener('touchend', () => {
        if (!active) return;
        active = false;
        handle.style.transform = 'translate(-50%, -50%)';
    });
}

function setBuildMode(mode) {
    gameState.buildMode = mode;
    buildButtons.forEach((btn) => {
        btn.classList.toggle('active', btn.dataset.type === mode);
    });
}

function panCamera(direction) {
    const step = TILE_WORLD_SIZE * 2.4;
    const vec = ISO_VECTORS[direction];
    if (!vec) return;
    const delta = vec.clone().multiplyScalar(step);
    cameraPivot.position.add(delta);
    refreshCameraPosition();
}

function adjustZoom(delta) {
    zoomFactor = THREE.MathUtils.clamp(zoomFactor + delta, 0.6, 1.6);
    refreshCameraPosition();
}

function handleBuildCommand(clientX, clientY) {
    if (!gameState.buildMode) return false;
    const tile = pickTile(clientX, clientY);
    if (!tile || !tile.walkable || tile.type === 'path' || tile.type === 'ramp') return false;
    if (tile.occupied) return false;

    const cost = gameState.buildMode === 'tower' ? 100 : 50;
    if (gameState.gold < cost) {
        window.alert('Not enough gold.');
        return true;
    }

    gameState.gold -= cost;
    if (gameState.buildMode === 'tower') {
        placeTower(tile);
    } else {
        placeWall(tile);
    }
    updateUI();
    return true;
}

function handleMoveCommand(clientX, clientY) {
    const tile = pickTile(clientX, clientY);
    if (!tile || !tile.walkable || tile.occupied) return;
    gameState.player.target = { x: tile.x, y: tile.y };
    facePlayerTowards(gridToWorld(tile.x, tile.y, 0));
}

function facePlayerTowards(targetWorld) {
    const { player } = gameState;
    if (!player.mesh || !targetWorld) return;
    playerLookTarget.copy(targetWorld);
    playerLookTarget.y = player.mesh.position.y;
    tempPlayerDirection.copy(playerLookTarget).sub(player.mesh.position);
    if (tempPlayerDirection.lengthSq() < 1e-6) return;
    player.mesh.lookAt(playerLookTarget);
    player.mesh.rotation.x = 0;
    player.mesh.rotation.z = 0;
    player.mesh.rotation.y += Math.PI;
}

function pickTile(clientX, clientY) {
    const rect = renderer.domElement.getBoundingClientRect();
    pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1;

    raycaster.setFromCamera(pointer, camera);
    const hits = raycaster.intersectObjects(tileMeshes, false);
    if (!hits.length) return null;
    const { x, y } = hits[0].object.userData;
    return gameState.terrain[y]?.[x] ?? null;
}

function placeTower(tile) {
    const towerGroup = new THREE.Group();

    const base = new THREE.Mesh(new THREE.CylinderGeometry(3.2, 3.6, 2.2, 8), materials.tower);
    base.castShadow = true;
    base.receiveShadow = true;
    base.position.y = 1.1;

    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 3.0, 6.4, 8), materials.tower);
    shaft.castShadow = true;
    shaft.receiveShadow = true;
    shaft.position.y = 5.3;

    const top = new THREE.Mesh(new THREE.ConeGeometry(2.8, 2.6, 8), new THREE.MeshStandardMaterial({ color: 0xd1b67a, roughness: 0.45, metalness: 0.25 }));
    top.castShadow = true;
    top.position.y = 8.2;

    towerGroup.add(base);
    towerGroup.add(shaft);
    towerGroup.add(top);

    const pos = gridToWorld(tile.x, tile.y, 0);
    towerGroup.position.set(pos.x, pos.y, pos.z);

    scene.add(towerGroup);

    tile.walkable = false;
    tile.occupied = 'tower';

    const towerData = {
        x: tile.x,
        y: tile.y,
        mesh: towerGroup,
        world: pos.clone().add(new THREE.Vector3(0, 7.5, 0)),
        range: TILE_WORLD_SIZE * 5,
        damage: 5,
        fireInterval: 0.6,
        cooldown: 0,
        projectileSpeed: 42,
        collider: null
    };
    gameState.towers.push(towerData);

    const collider = {
        type: 'tower',
        object: towerGroup,
        radius: TILE_WORLD_SIZE * 1.4,
        hitPoints: 14,
        maxHitPoints: 14,
        tile,
        data: towerData
    };
    towerData.collider = collider;
    colliders.push(collider);
}

function placeWall(tile) {
    const wallHeight = 4.8;
    const wallGeometry = new THREE.BoxGeometry(TILE_WORLD_SIZE * 1.1, wallHeight, TILE_WORLD_SIZE * 1.1);
    const wallMesh = new THREE.Mesh(wallGeometry, materials.wall);
    wallMesh.castShadow = true;
    wallMesh.receiveShadow = true;

    const pos = gridToWorld(tile.x, tile.y, 0);
    wallMesh.position.set(pos.x, pos.y + wallHeight / 2, pos.z);

    scene.add(wallMesh);

    tile.walkable = false;
    tile.occupied = 'wall';

    const wallData = {
        x: tile.x,
        y: tile.y,
        mesh: wallMesh,
        collider: null
    };
    gameState.walls.push(wallData);

    const collider = {
        type: 'wall',
        object: wallMesh,
        radius: TILE_WORLD_SIZE * 1.2,
        hitPoints: 10,
        maxHitPoints: 10,
        tile,
        data: wallData
    };
    wallData.collider = collider;
    colliders.push(collider);
}

function spawnMonster() {
    const path = gameState.path;
    if (!path.length) return;

    const startPoint = path[0];
    const spawnWorld = gridToWorld(startPoint.x, Math.max(startPoint.y - 3, -4), 0.6);
    const mesh = createMonsterMesh();
    mesh.position.copy(spawnWorld);
    scene.add(mesh);

    const healthBar = mesh.userData.healthBar;

    const monster = {
        mesh,
        world: spawnWorld.clone(),
        pathIndex: 0,
        speed: 6 + gameState.wave * 0.4,
        health: 5,
        maxHealth: 5,
        path,
        targetWorld: gridToWorld(startPoint.x, startPoint.y, 0.6),
        radius: 2.4,
        isMonster: true,
        attackDamage: 1,
        healthBar
    };

    updateMonsterHealthBar(monster);

    gameState.monsters.push(monster);
}

function createMonsterMesh() {
    const group = new THREE.Group();

    const body = new THREE.Mesh(new THREE.SphereGeometry(1.6, 16, 12), materials.monster);
    body.castShadow = true;
    body.receiveShadow = true;
    body.position.y = 1.6;

    const lower = new THREE.Mesh(new THREE.CylinderGeometry(1.3, 1.8, 1.2, 12), materials.monster);
    lower.castShadow = true;
    lower.receiveShadow = true;
    lower.position.y = 0.6;

    const hornMaterial = new THREE.MeshStandardMaterial({ color: 0xf5e6a1, roughness: 0.4, metalness: 0.25 });
    const hornGeometry = new THREE.ConeGeometry(0.4, 1.2, 4);
    const leftHorn = new THREE.Mesh(hornGeometry, hornMaterial);
    leftHorn.position.set(-0.7, 2.8, 0.3);
    leftHorn.rotation.z = Math.PI * 0.2;
    leftHorn.castShadow = true;

    const rightHorn = leftHorn.clone();
    rightHorn.position.x = 0.7;
    rightHorn.rotation.z = -Math.PI * 0.2;

    const healthBar = createHealthBar();
    healthBar.group.position.set(0, 3.6, 0);

    group.add(lower);
    group.add(body);
    group.add(leftHorn);
    group.add(rightHorn);
    group.add(healthBar.group);

    group.userData.healthBar = healthBar;

    return group;
}

function createHealthBar() {
    const group = new THREE.Group();

    const backgroundGeometry = new THREE.PlaneGeometry(2.6, 0.32);
    const backgroundMaterial = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.6, depthTest: false });
    const background = new THREE.Mesh(backgroundGeometry, backgroundMaterial);
    background.renderOrder = 1000;

    const fillGeometry = new THREE.PlaneGeometry(2.4, 0.22);
    const fillMaterial = new THREE.MeshBasicMaterial({ color: 0x4cff4c, transparent: true, opacity: 0.9, depthTest: false });
    const fill = new THREE.Mesh(fillGeometry, fillMaterial);
    fill.position.z = 0.01;
    fill.renderOrder = 1001;

    group.add(background);
    group.add(fill);

    return { group, fill };
}

function updateMonsterHealthBar(monster) {
    if (!monster.healthBar) return;
    const { group, fill } = monster.healthBar;
    const ratio = THREE.MathUtils.clamp(monster.health / monster.maxHealth, 0, 1);

    fill.scale.x = ratio;
    fill.position.x = -1.2 + ratio * 1.2;
    if (ratio > 0.6) {
        fill.material.color.set(0x4cff4c);
    } else if (ratio > 0.3) {
        fill.material.color.set(0xffc107);
    } else {
        fill.material.color.set(0xff4c4c);
    }

    group.visible = monster.health > 0;
    group.quaternion.copy(camera.quaternion);
}

function updatePlayer(delta) {
    const { player } = gameState;
    if (!player.target || !player.mesh) return;

    const targetWorld = gridToWorld(player.target.x, player.target.y, 0);
    facePlayerTowards(targetWorld);
    const direction = targetWorld.clone().sub(player.world);
    const distance = direction.length();
    if (distance < 0.05) {
        player.world.copy(targetWorld);
        player.mesh.position.copy(targetWorld);
        player.grid = { ...player.target };
        player.target = null;
        return;
    }

    const travel = player.speed * delta;
    const move = Math.min(distance, travel);
    direction.normalize().multiplyScalar(move);
    const previous = player.world.clone();
    player.world.add(direction);
    player.world.y = targetWorld.y;
    player.mesh.position.copy(player.world);
    const collisionResult = resolveCollisions(player, previous);
    if (collisionResult && collisionResult.type === 'blocked') {
        player.world.copy(previous);
        player.mesh.position.copy(previous);
        player.target = null;
    }
}

function updateMonsters(delta) {
    for (let i = gameState.monsters.length - 1; i >= 0; i -= 1) {
        const monster = gameState.monsters[i];
        if (!monster.targetWorld || !monster.mesh) continue;

        const direction = monster.targetWorld.clone().sub(monster.world);
        const distance = direction.length();
        const travel = monster.speed * delta;
        const previous = monster.world.clone();

        if (distance <= travel) {
            monster.world.copy(monster.targetWorld);
            monster.pathIndex += 1;

            if (monster.pathIndex >= monster.path.length) {
                damageBase();
                destroyMonster(monster);
                continue;
            }

            const nextTile = monster.path[monster.pathIndex];
            monster.targetWorld = gridToWorld(nextTile.x, nextTile.y, 0.6);
        } else {
            direction.normalize().multiplyScalar(travel);
            monster.world.add(direction);
        }

        if (!monster.mesh) continue;
        monster.mesh.position.copy(monster.world);
        updateMonsterHealthBar(monster);

        const collisionResult = resolveCollisions(monster, previous, i);
        if (collisionResult === 'removed') {
            continue;
        } else if (collisionResult && collisionResult.type === 'blocked') {
            monster.world.copy(previous);
            monster.mesh.position.copy(previous);
            const outcome = handleMonsterBlocked(monster, collisionResult.collider, delta);
            if (outcome !== 'destroyed') {
                // keep target as is to try again next frame
            }
            continue;
        }
    }
}

function updateTowers(delta) {
    for (const tower of gameState.towers) {
        if (tower.cooldown > 0) {
            tower.cooldown -= delta;
        }

        let nearest = null;
        let nearestDist = Infinity;
        for (const monster of gameState.monsters) {
            const dist = tower.world.distanceTo(monster.world);
            if (dist <= tower.range && dist < nearestDist) {
                nearest = monster;
                nearestDist = dist;
            }
        }

        if (nearest && tower.cooldown <= 0) {
            spawnProjectile(tower, nearest);
            tower.cooldown = tower.fireInterval;
        }
    }
}

function spawnProjectile(tower, target) {
    const projectileMesh = createArrowProjectileMesh();
    projectileMesh.position.copy(tower.world);
    projectileMesh.position.y = Math.max(projectileMesh.position.y, tower.world.y + 0.5);

    const initialDirection = target.world.clone().sub(projectileMesh.position).normalize();
    const initialQuaternion = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), initialDirection);
    projectileMesh.setRotationFromQuaternion(initialQuaternion);

    scene.add(projectileMesh);

    const projectile = {
        mesh: projectileMesh,
        target,
        speed: tower.projectileSpeed,
        damage: tower.damage
    };

    gameState.projectiles.push(projectile);
}

function updateProjectiles(delta) {
    for (let i = gameState.projectiles.length - 1; i >= 0; i -= 1) {
        const projectile = gameState.projectiles[i];
        const target = projectile.target;
        const mesh = projectile.mesh;

        if (!mesh) {
            gameState.projectiles.splice(i, 1);
            continue;
        }

        if (!target || !target.mesh || gameState.monsters.indexOf(target) === -1) {
            scene.remove(mesh);
            gameState.projectiles.splice(i, 1);
            continue;
        }

        const targetPos = target.world.clone().add(new THREE.Vector3(0, 1.8, 0));
        const direction = targetPos.clone().sub(mesh.position);
        const distance = direction.length();
        const travel = projectile.speed * delta;

        if (distance <= travel) {
            mesh.position.copy(targetPos);
            scene.remove(mesh);
            gameState.projectiles.splice(i, 1);
            hitMonster(target, projectile.damage);
            continue;
        }

        direction.normalize().multiplyScalar(travel);
        mesh.position.add(direction);

        const lookDir = targetPos.clone().sub(mesh.position).normalize();
        const quaternion = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), lookDir);
        mesh.setRotationFromQuaternion(quaternion);
    }
}

function resolveCollisions(unit, previousWorld, monsterIndex) {
    if (!unit.world) return null;

    for (const collider of colliders) {
        const colliderPos = collider.object.position;
        const colliderRadius = collider.radius + (unit.radius ?? 1);
        if (colliderPos.distanceTo(unit.world) < colliderRadius) {
            if (collider.type === 'home') {
                if (unit.isMonster) {
                    damageBase();
                    destroyMonster(unit);
                    return 'removed';
                }
                if (unit.isPlayer) {
                    continue;
                }
            }
            return { type: 'blocked', collider };
        }
    }

    return null;
}

function handleMonsterBlocked(monster, collider, delta) {
    if (!collider) return null;
    if ((collider.type === 'tower' || collider.type === 'wall') && collider.hitPoints !== undefined) {
        collider.hitPoints -= (monster.attackDamage ?? 1) * delta;
        collider.hitPoints = Math.max(collider.hitPoints, 0);
        if (collider.hitPoints <= 0) {
            destroyStructure(collider);
            return 'destroyed';
        }
    }
    return null;
}

function destroyStructure(collider) {
    const index = colliders.indexOf(collider);
    if (index !== -1) {
        colliders.splice(index, 1);
    }

    if (collider.type === 'tower') {
        gameState.towers = gameState.towers.filter((tower) => tower.mesh !== collider.object);
    } else if (collider.type === 'wall') {
        gameState.walls = gameState.walls.filter((wall) => wall.mesh !== collider.object);
    }

    if (collider.tile) {
        collider.tile.walkable = true;
        collider.tile.occupied = false;
    }

    scene.remove(collider.object);
}

function hitMonster(monster, damage) {
    const index = gameState.monsters.indexOf(monster);
    if (index === -1) return;

    monster.health -= damage;
    updateMonsterHealthBar(monster);

    if (monster.health <= 0) {
        destroyMonster(monster);
        gameState.gold += 1;
        updateUI();
    }
}

function destroyMonster(monster) {
    const index = gameState.monsters.indexOf(monster);
    if (index !== -1) {
        gameState.monsters.splice(index, 1);
    }
    if (monster.mesh) {
        scene.remove(monster.mesh);
        monster.mesh = null;
    }
}

function damageBase() {
    gameState.health -= 1;
    if (gameState.health <= 0) {
        window.alert('The fortress has fallen. Restarting...');
        window.location.reload();
        return;
    }
    updateUI();
}

function updateUI() {
    goldEl.textContent = Math.floor(gameState.gold);
    waveEl.textContent = gameState.wave;
    healthEl.textContent = Math.max(gameState.health, 0);
}

function startWave() {
    const total = 8 + gameState.wave * 3;
    let spawned = 0;

    if (gameState.spawnTimer) {
        clearInterval(gameState.spawnTimer);
        gameState.spawnTimer = null;
    }

    gameState.spawnTimer = window.setInterval(() => {
        if (spawned >= total) {
            clearInterval(gameState.spawnTimer);
            gameState.spawnTimer = null;
            return;
        }
        spawnMonster();
        spawned += 1;
    }, Math.max(450, 1700 - gameState.wave * 120));
}

function scheduleNextWave() {
    if (gameState.nextWaveTimeout || gameState.spawnTimer || gameState.monsters.length > 0) return;
    gameState.nextWaveTimeout = window.setTimeout(() => {
        gameState.wave += 1;
        gameState.gold += 160;
        updateUI();
        startWave();
        gameState.nextWaveTimeout = null;
    }, 4500);
}

function animate() {
    requestAnimationFrame(animate);
    const delta = clock.getDelta();

    updatePlayer(delta);
    updateMonsters(delta);
    updateTowers(delta);
    updateProjectiles(delta);
    scheduleNextWave();

    renderer.render(scene, camera);
}

function gridToWorld(x, y, yOffset = 0) {
    const offset = (MAP_SIZE * TILE_WORLD_SIZE) / 2;
    const worldX = x * TILE_WORLD_SIZE - offset + TILE_WORLD_SIZE / 2;
    const worldZ = y * TILE_WORLD_SIZE - offset + TILE_WORLD_SIZE / 2;

    let top = GROUND_HEIGHT;
    const tile = gameState.terrain[y]?.[x];
    if (tile) {
        top = tile.height;
    }

    return new THREE.Vector3(worldX, top + yOffset, worldZ);
}

function onWindowResize() {
    const width = window.innerWidth;
    const height = window.innerHeight;
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
    refreshCameraPosition();
}

init();


