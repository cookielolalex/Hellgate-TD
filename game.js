import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';

const PLATEAU_SIZE = 12;
const TERRAIN_PADDING = 16;
const MAP_SIZE = PLATEAU_SIZE + TERRAIN_PADDING * 2;
const TILE_WORLD_SIZE = 6;
const HALF_PLATEAU = PLATEAU_SIZE / 2;
const PLATEAU_CENTER = Math.floor(MAP_SIZE / 2);
const PLATEAU_MIN = PLATEAU_CENTER - HALF_PLATEAU;
const PLATEAU_MAX = PLATEAU_MIN + PLATEAU_SIZE - 1;
const RAMP_TILE = { x: PLATEAU_CENTER, y: PLATEAU_MIN - 1 };
const GROUND_EXTENT_MULTIPLIER = 8;

const GAME_VERSION = '1.0.0-mobile-iteration';
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
const statusPanel = document.getElementById('structureStatusPanel');
const statusTitle = document.getElementById('statusTitle');
const statusHealth = document.getElementById('statusHealth');
const statusDamage = document.getElementById('statusDamage');
const statusSpeed = document.getElementById('statusSpeed');
const statusEffect = document.getElementById('statusEffect');
const upgradeBtn = document.getElementById('upgradeBtn');
const demolishBtn = document.getElementById('demolishBtn');
const closeStatusPanel = document.getElementById('closeStatusPanel');
const statusDescription = document.getElementById('statusDescription');
const DEFAULT_STATUS_DESCRIPTION = 'Select a tower or wall to inspect its stats.';

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
const PLAYER_ORIENTATION_OFFSET = 0;
const tempPlayerDirection = new THREE.Vector3();
const playerLookTarget = new THREE.Vector3();
let boundaryFog;
let groundPlane;
let hellgate;
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
    tower: new THREE.MeshStandardMaterial({ color: 0x6c7a8d, roughness: 0.35, metalness: 0.28 }),
    towerTrim: new THREE.MeshStandardMaterial({ color: 0x3d4655, roughness: 0.42, metalness: 0.2 }),
    towerRune: new THREE.MeshStandardMaterial({ color: 0x68f2ff, emissive: 0x2fc0ff, emissiveIntensity: 1.8, roughness: 0.18, metalness: 0.55 }),
    wall: new THREE.MeshStandardMaterial({ color: 0xa8967d, roughness: 0.5, metalness: 0.22 }),
    wallTrim: new THREE.MeshStandardMaterial({ color: 0x7c6a57, roughness: 0.55, metalness: 0.18 }),
    angelRobe: new THREE.MeshStandardMaterial({ color: 0xf4f0ff, roughness: 0.38, metalness: 0.22 }),
    angelTrim: new THREE.MeshStandardMaterial({ color: 0xc9a35c, roughness: 0.34, metalness: 0.55 }),
    angelWing: new THREE.MeshStandardMaterial({ color: 0xfefcff, roughness: 0.18, metalness: 0.08, transparent: true, opacity: 0.92, side: THREE.DoubleSide }),
    angelHalo: new THREE.MeshStandardMaterial({ color: 0xffe57f, emissive: 0xffd54f, emissiveIntensity: 2.1, roughness: 0.2, metalness: 0.7 }),
    angelGlow: new THREE.MeshStandardMaterial({ color: 0xaad6ff, emissive: 0x9ad0ff, emissiveIntensity: 0.8, transparent: true, opacity: 0.4, side: THREE.DoubleSide }),
    monster: new THREE.MeshStandardMaterial({ color: 0xe24b47, roughness: 0.45, metalness: 0.35 }),
    homeWall: new THREE.MeshStandardMaterial({ color: 0xf1d7b1, roughness: 0.58, metalness: 0.18 }),
    homeTimber: new THREE.MeshStandardMaterial({ color: 0x7b4b2f, roughness: 0.62, metalness: 0.12 }),
    homeRoof: new THREE.MeshStandardMaterial({ color: 0xc95b3f, roughness: 0.52, metalness: 0.22 }),
    homeLight: new THREE.MeshStandardMaterial({ color: 0xfff4a1, emissive: 0xffe066, emissiveIntensity: 1.6, roughness: 0.35, metalness: 0.2 }),
    projectileCore: new THREE.MeshStandardMaterial({ color: 0xffe57f, emissive: 0xffc400, emissiveIntensity: 1.8, roughness: 0.2, metalness: 0.65 }),
    projectileTip: new THREE.MeshStandardMaterial({ color: 0xff7043, emissive: 0xff6d00, emissiveIntensity: 1.2, roughness: 0.25, metalness: 0.7 }),
    projectileFletch: new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0x8bc34a, emissiveIntensity: 0.8, roughness: 0.3, metalness: 0.4 }),
    ground: new THREE.MeshLambertMaterial({ color: 0x1f4030 })
};

const projectileGeometry = new THREE.SphereGeometry(1.1, 18, 18);

const gameState = {
    gold: 500,
    health: 100,
    maxHealth: 100,
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
    structureBars: [],
    selectedStructure: null,
    player: {
        grid: { x: PLATEAU_CENTER, y: PLATEAU_CENTER + 3 },
        world: new THREE.Vector3(),
        target: null,
        mesh: null,
        speed: 12,
        radius: 1.4,
        isPlayer: true,
        joystickInput: new THREE.Vector2()
    },
    home: null,
    homeHealthBar: null
};

function init() {
    setupRenderer();
    setupScene();
    createGroundPlane();
    createLights();
    generateTerrain();
    createHellgate();
    createHomeBase();
    createPlayer();
    createBoundaryFog();
    setupUIListeners();
    setupPointerListeners();
    setupTouchControls();
    setupGestureControls();
    const versionEl = document.getElementById('gameVersion');
    if (versionEl) {
        versionEl.textContent = GAME_VERSION;
    }
    updateUI();
    startWave();
    animate();
}

function setupRenderer() {
    renderer = new THREE.WebGLRenderer({ antialias: true, canvas });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
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

function createGroundPlane() {
    if (groundPlane) {
        scene.remove(groundPlane);
    }
    const size = MAP_SIZE * TILE_WORLD_SIZE * GROUND_EXTENT_MULTIPLIER;
    const geometry = new THREE.PlaneGeometry(size, size, 1, 1);
    const material = materials.ground;
    groundPlane = new THREE.Mesh(geometry, material);
    groundPlane.rotation.x = -Math.PI / 2;
    groundPlane.position.y = 0;
    groundPlane.receiveShadow = true;
    scene.add(groundPlane);
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
    directional.shadow.mapSize.width = 2048;
    directional.shadow.mapSize.height = 2048;
    directional.shadow.camera.left = -120;
    directional.shadow.camera.right = 120;
    directional.shadow.camera.top = 120;
    directional.shadow.camera.bottom = -120;
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
    tileGroup.traverse((child) => {
        if (child.isMesh) {
            child.matrixAutoUpdate = false;
            child.updateMatrix();
        }
    });
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
    const foundationHeight = 1.2;
    const bodyHeight = 3.8;
    const roofHeight = 3.2;

    const foundation = new THREE.Mesh(
        new THREE.BoxGeometry(TILE_WORLD_SIZE * 2, foundationHeight, TILE_WORLD_SIZE * 1.9),
        materials.wallTrim
    );
    foundation.castShadow = true;
    foundation.receiveShadow = true;
    foundation.position.y = foundationHeight / 2;

    const body = new THREE.Mesh(
        new THREE.BoxGeometry(TILE_WORLD_SIZE * 1.8, bodyHeight, TILE_WORLD_SIZE * 1.4),
        materials.homeWall
    );
    body.castShadow = true;
    body.receiveShadow = true;
    body.position.y = foundationHeight + bodyHeight / 2;

    const beamOffsets = [-0.65, 0, 0.65];
    beamOffsets.forEach((x) => {
        const beam = new THREE.Mesh(
            new THREE.BoxGeometry(0.35, bodyHeight + 0.2, 0.5),
            materials.homeTimber
        );
        beam.castShadow = true;
        beam.receiveShadow = true;
        beam.position.set(x * TILE_WORLD_SIZE * 0.55, foundationHeight + (bodyHeight / 2), TILE_WORLD_SIZE * 0.72);
        group.add(beam);
    });

    const crossBeam = new THREE.Mesh(
        new THREE.BoxGeometry(TILE_WORLD_SIZE * 1.7, 0.35, 0.3),
        materials.homeTimber
    );
    crossBeam.position.set(0, foundationHeight + bodyHeight - 0.2, 0.71 * TILE_WORLD_SIZE);
    crossBeam.castShadow = true;
    crossBeam.receiveShadow = true;
    group.add(crossBeam);

    const roof = new THREE.Mesh(
        new THREE.ConeGeometry(TILE_WORLD_SIZE * 1.75, roofHeight, 4),
        materials.homeRoof
    );
    roof.castShadow = true;
    roof.receiveShadow = true;
    roof.rotation.y = Math.PI / 4;
    roof.position.y = foundationHeight + bodyHeight + roofHeight / 2;

    const roofCap = new THREE.Mesh(
        new THREE.ConeGeometry(TILE_WORLD_SIZE * 0.6, 0.8, 4),
        materials.wallTrim
    );
    roofCap.position.y = foundationHeight + bodyHeight + roofHeight + 0.4;
    roofCap.rotation.y = Math.PI / 4;
    roofCap.castShadow = true;
    roofCap.receiveShadow = true;

    const door = new THREE.Mesh(
        new THREE.BoxGeometry(TILE_WORLD_SIZE * 0.4, 2.6, 0.2),
        materials.homeTimber
    );
    door.position.set(0, foundationHeight + 1.3, TILE_WORLD_SIZE * 0.75);
    door.castShadow = true;

    const doorFrame = new THREE.Mesh(
        new THREE.TorusGeometry(TILE_WORLD_SIZE * 0.22, 0.08, 8, 24),
        materials.homeTimber
    );
    doorFrame.rotation.x = Math.PI / 2;
    doorFrame.position.set(0, foundationHeight + 2.1, TILE_WORLD_SIZE * 0.75 + 0.05);
    doorFrame.castShadow = true;

    const window = new THREE.Mesh(
        new THREE.PlaneGeometry(TILE_WORLD_SIZE * 0.6, TILE_WORLD_SIZE * 0.5),
        materials.homeLight.clone()
    );
    window.position.set(0, foundationHeight + bodyHeight - 1.1, TILE_WORLD_SIZE * 0.75 + 0.01);
    window.material.side = THREE.DoubleSide;

    const roofBeam = new THREE.Mesh(
        new THREE.BoxGeometry(0.35, roofHeight + 1.0, 0.35),
        materials.homeTimber
    );
    roofBeam.position.set(0, foundationHeight + bodyHeight + (roofHeight / 2), 0);
    roofBeam.castShadow = true;
    roofBeam.receiveShadow = true;

    const flagPole = new THREE.Mesh(
        new THREE.CylinderGeometry(0.08, 0.08, 3.8, 12),
        materials.homeTimber
    );
    flagPole.position.set(TILE_WORLD_SIZE * 0.65, foundationHeight + bodyHeight + roofHeight, 0);
    flagPole.castShadow = true;
    flagPole.receiveShadow = true;

    const flagMaterial = new THREE.MeshStandardMaterial({ color: 0xf26f4f, roughness: 0.45, metalness: 0.2, side: THREE.DoubleSide });
    const flag = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.9), flagMaterial);
    flag.position.set(0, 1.4, 0);
    flag.rotation.y = -Math.PI / 2.6;
    flagPole.add(flag);

    group.add(foundation);
    group.add(body);
    group.add(roof);
    group.add(roofCap);
    group.add(door);
    group.add(doorFrame);
    group.add(window);
    group.add(roofBeam);
    group.add(flagPole);

    const pos = gridToWorld(PLATEAU_CENTER, PLATEAU_CENTER, 0);
    group.position.set(pos.x, pos.y, pos.z);

    scene.add(group);
    gameState.home = group;
    const healthBarOffset = foundationHeight + bodyHeight + roofHeight + 1.6;
    const homeHealthBar = addStructureHealthBar(
        group,
        () => gameState.health,
        () => gameState.maxHealth,
        { width: 5.2, height: 0.3, offset: healthBarOffset }
    );
    gameState.homeHealthBar = homeHealthBar;
}

function createHellgate() {
    if (hellgate) {
        scene.remove(hellgate);
    }
    const gateGroup = new THREE.Group();

    const baseMaterial = new THREE.MeshStandardMaterial({ color: 0x2d1a18, roughness: 0.68, metalness: 0.15 });
    const accentMaterial = new THREE.MeshStandardMaterial({ color: 0x7a2b17, roughness: 0.38, metalness: 0.35 });
    const glowMaterial = new THREE.MeshBasicMaterial({ color: 0xff7a2f, transparent: true, opacity: 0.85 });

    const podium = new THREE.Mesh(new THREE.BoxGeometry(16, 2.4, 10), baseMaterial);
    podium.position.y = 1.2;
    podium.castShadow = true;
    podium.receiveShadow = true;

    const archColumns = new THREE.CylinderGeometry(1, 1.5, 14, 16);
    const leftColumn = new THREE.Mesh(archColumns, baseMaterial);
    leftColumn.position.set(-4, 7.5, -2);
    leftColumn.castShadow = true;
    leftColumn.receiveShadow = true;

    const rightColumn = leftColumn.clone();
    rightColumn.position.x = 4;

    const arch = new THREE.Mesh(new THREE.TorusGeometry(6, 1.2, 16, 48, Math.PI), accentMaterial);
    arch.rotation.z = Math.PI;
    arch.position.set(0, 13, -2);
    arch.castShadow = true;
    arch.receiveShadow = true;

    const portal = new THREE.Mesh(new THREE.PlaneGeometry(6, 12), glowMaterial);
    portal.position.set(0, 7, -2.5);
    portal.material.side = THREE.DoubleSide;

    const portalInner = portal.clone();
    portalInner.scale.set(0.8, 0.8, 0.8);
    portalInner.material = glowMaterial.clone();
    portalInner.material.opacity = 0.4;

    const flameLight = new THREE.PointLight(0xff5a2c, 2.2, 100, 2.4);
    flameLight.position.set(0, 8, -2);

    gateGroup.add(podium);
    gateGroup.add(leftColumn);
    gateGroup.add(rightColumn);
    gateGroup.add(arch);
    gateGroup.add(portal);
    gateGroup.add(portalInner);
    gateGroup.add(flameLight);

    const gateGridY = Math.max(RAMP_TILE.y - 3, 0);
    const gateWorld = gridToWorld(RAMP_TILE.x, gateGridY, 0);
    gateGroup.position.set(gateWorld.x, gateWorld.y, gateWorld.z - TILE_WORLD_SIZE * 1.5);
    gateGroup.rotation.y = Math.PI;

    scene.add(gateGroup);
    hellgate = gateGroup;
}

function createPlayer() {
    const angelGroup = new THREE.Group();
    angelGroup.name = 'GuardianAngel';

    const robe = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 2.6, 6.4, 32, 1, false), materials.angelRobe);
    robe.castShadow = true;
    robe.receiveShadow = true;
    robe.position.y = 3.6;

    const trim = new THREE.Mesh(new THREE.TorusGeometry(2.1, 0.18, 16, 48), materials.angelTrim);
    trim.rotation.x = Math.PI / 2;
    trim.position.y = 3.6;

    const torso = new THREE.Mesh(new THREE.SphereGeometry(1.4, 28, 20), materials.angelTrim);
    torso.castShadow = true;
    torso.receiveShadow = true;
    torso.position.y = 6.1;

    const chestGlow = new THREE.Mesh(new THREE.SphereGeometry(0.9, 24, 16), materials.angelGlow);
    chestGlow.position.set(0, 6.1, 1.2);

    const head = new THREE.Mesh(new THREE.SphereGeometry(1.0, 24, 16), materials.angelRobe.clone());
    head.position.y = 7.6;

    const halo = new THREE.Mesh(new THREE.TorusGeometry(1.8, 0.2, 24, 64), materials.angelHalo);
    halo.rotation.x = Math.PI / 2;
    halo.position.y = 8.5;

    const haloGlow = new THREE.Mesh(new THREE.CircleGeometry(2.2, 48), materials.angelGlow);
    haloGlow.rotation.x = -Math.PI / 2;
    haloGlow.position.y = 8.52;

    const wingGeometry = new THREE.PlaneGeometry(6.4, 4.6);
    const leftWing = new THREE.Mesh(wingGeometry, materials.angelWing);
    leftWing.position.set(-2.8, 6.2, -0.4);
    leftWing.rotation.set(THREE.MathUtils.degToRad(12), THREE.MathUtils.degToRad(65), THREE.MathUtils.degToRad(6));

    const rightWing = leftWing.clone();
    rightWing.position.x = 2.8;
    rightWing.rotation.y = -THREE.MathUtils.degToRad(65);

    const lowerGlow = new THREE.Mesh(new THREE.CircleGeometry(3.4, 48), materials.angelGlow);
    lowerGlow.rotation.x = -Math.PI / 2;
    lowerGlow.position.y = 0.1;

    const staff = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 6.8, 12), materials.angelTrim);
    staff.position.set(1.4, 5.0, 1.0);
    staff.rotation.z = THREE.MathUtils.degToRad(-12);

    const staffLight = new THREE.Mesh(new THREE.SphereGeometry(0.6, 16, 12), materials.angelGlow);
    staffLight.position.y = 3.6;
    staff.add(staffLight);

    const heroLight = new THREE.PointLight(0xaed8ff, 2.4, 60, 2.2);
    heroLight.position.set(0, 7.2, 0);

    angelGroup.add(lowerGlow);
    angelGroup.add(robe);
    angelGroup.add(trim);
    angelGroup.add(torso);
    angelGroup.add(chestGlow);
    angelGroup.add(head);
    angelGroup.add(haloGlow);
    angelGroup.add(halo);
    angelGroup.add(leftWing);
    angelGroup.add(rightWing);
    angelGroup.add(staff);
    angelGroup.add(heroLight);

    const pos = gridToWorld(gameState.player.grid.x, gameState.player.grid.y, 0);
    angelGroup.position.copy(pos);
    angelGroup.position.y += 0.8;

    scene.add(angelGroup);
    gameState.player.mesh = angelGroup;
    gameState.player.world.copy(angelGroup.position);
}

function createFogTexture(size = 512) {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = 'rgba(9,13,20,0.95)';
    ctx.beginPath();
    ctx.ellipse(size / 2, size / 2, size / 2, size / 2, 0, 0, Math.PI * 2);
    ctx.fill();
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.ClampToEdgeWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    texture.needsUpdate = true;
    return texture;
}

function createBoundaryFog() {
    if (boundaryFog) {
        scene.remove(boundaryFog);
    }
    const outerRadius = (PLATEAU_SIZE * TILE_WORLD_SIZE) / 2 + TILE_WORLD_SIZE * 2.5;
    const geometry = new THREE.RingGeometry((PLATEAU_SIZE * TILE_WORLD_SIZE) / 2, outerRadius, 64);
    const material = new THREE.MeshBasicMaterial({
        map: createFogTexture(),
        transparent: true,
        depthWrite: false,
        opacity: 1,
        side: THREE.DoubleSide
    });
    boundaryFog = new THREE.Mesh(geometry, material);
    boundaryFog.rotation.x = -Math.PI / 2;
    boundaryFog.position.y = 0.6;
    scene.add(boundaryFog);
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

    upgradeBtn.addEventListener('click', upgradeStructure);
    demolishBtn.addEventListener('click', demolishStructure);
    closeStatusPanel.addEventListener('click', hideStatusPanel);
}

function setupPointerListeners() {
    const target = renderer.domElement;

    target.addEventListener('contextmenu', (event) => event.preventDefault());

    target.addEventListener('pointerdown', (event) => {
        if (event.pointerType === 'touch') {
            return;
        }
        if (event.button === 2) {
            hideStatusPanel();
            handleMoveCommand(event.clientX, event.clientY);
        } else if (event.button === 0) {
            const structure = pickStructure(event.clientX, event.clientY);
            if (structure) {
                showStatusPanel(structure);
                return;
            }
            hideStatusPanel();
            if (!handleBuildCommand(event.clientX, event.clientY)) {
                handleMoveCommand(event.clientX, event.clientY);
            }
        }
    });

    target.addEventListener('pointerup', (event) => {
        if (event.pointerType === 'touch') {
            const coords = event.changedTouches && event.changedTouches[0];
            if (!coords) return;
            const structure = pickStructure(coords.clientX, coords.clientY);
            if (structure) {
                showStatusPanel(structure);
                return;
            }
            hideStatusPanel();
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
    let touchId = null;
    const maxDistance = joystick.offsetWidth / 2 - 20;

    function updateHandle(clientX, clientY) {
        const rect = joystick.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        const dx = clientX - centerX;
        const dy = clientY - centerY;
        const distance = Math.min(Math.hypot(dx, dy), maxDistance);
        const angle = Math.atan2(dy, dx);
        const offsetX = Math.cos(angle) * distance;
        const offsetY = Math.sin(angle) * distance;
        handle.style.transform = `translate(calc(-50% + ${offsetX}px), calc(-50% + ${offsetY}px))`;
        const normalizedX = offsetX / maxDistance;
        const normalizedY = offsetY / maxDistance;
        gameState.player.joystickInput.set(normalizedX, normalizedY);
    }

    function resetHandle() {
        handle.style.transform = 'translate(-50%, -50%)';
        gameState.player.joystickInput.set(0, 0);
    }

    joystick.addEventListener('touchstart', (event) => {
        const touch = event.touches[0];
        if (!touch) return;
        active = true;
        touchId = touch.identifier;
        joystick.style.opacity = '1';
        updateHandle(touch.clientX, touch.clientY);
    });

    joystick.addEventListener('touchmove', (event) => {
        if (!active) return;
        const touch = Array.from(event.touches).find((t) => t.identifier === touchId);
        if (!touch) return;
        event.preventDefault();
        updateHandle(touch.clientX, touch.clientY);
    }, { passive: false });

    const endHandler = () => {
        if (!active) return;
        active = false;
        touchId = null;
        resetHandle();
    };

    joystick.addEventListener('touchend', endHandler);
    joystick.addEventListener('touchcancel', endHandler);
}

function setupGestureControls() {
    const target = renderer.domElement;
    const gestureState = {
        initialDistance: null,
        initialZoom: null
    };

    function getTouchDistance(touches) {
        const [a, b] = touches;
        return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
    }

    target.addEventListener('touchstart', (event) => {
        if (event.touches.length === 2) {
            gestureState.initialDistance = getTouchDistance(event.touches);
            gestureState.initialZoom = zoomFactor;
        }
    }, { passive: true });

    target.addEventListener('touchmove', (event) => {
        if (event.touches.length === 2 && gestureState.initialDistance) {
            event.preventDefault();
            const distance = getTouchDistance(event.touches);
            const delta = (gestureState.initialDistance - distance) / 400;
            zoomFactor = THREE.MathUtils.clamp(gestureState.initialZoom + delta, 0.6, 1.6);
            refreshCameraPosition();
        }
    }, { passive: false });

    function resetGesture() {
        gestureState.initialDistance = null;
        gestureState.initialZoom = null;
    }

    target.addEventListener('touchend', resetGesture);
    target.addEventListener('touchcancel', resetGesture);
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
    const yaw = Math.atan2(tempPlayerDirection.x, tempPlayerDirection.z);
    player.mesh.rotation.set(0, yaw + PLAYER_ORIENTATION_OFFSET, 0);
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

function pickStructure(clientX, clientY) {
    const rect = renderer.domElement.getBoundingClientRect();
    pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1;

    raycaster.setFromCamera(pointer, camera);
    
    const allStructures = [];
    gameState.towers.forEach(tower => {
        if (tower.mesh) allStructures.push(tower.mesh);
    });
    gameState.walls.forEach(wall => {
        if (wall.mesh) allStructures.push(wall.mesh);
    });

    const hits = raycaster.intersectObjects(allStructures, true);
    if (!hits.length) return null;

    const hitObject = hits[0].object;
    let structure = null;

    function findParentStructure(obj) {
        if (!obj) return null;
        for (const tower of gameState.towers) {
            if (tower.mesh === obj || (tower.mesh && tower.mesh.children.includes(obj))) {
                return tower;
            }
        }
        for (const wall of gameState.walls) {
            if (wall.mesh === obj || (wall.mesh && wall.mesh.children.includes(obj))) {
                return wall;
            }
        }
        if (obj.parent) return findParentStructure(obj.parent);
        return null;
    }

    structure = findParentStructure(hitObject);
    return structure;
}

function refreshStatusPanel() {
    const structure = gameState.selectedStructure;
    if (!structure) return;

    const exists =
        (structure.type === 'tower' && gameState.towers.includes(structure)) ||
        (structure.type === 'wall' && gameState.walls.includes(structure));

    if (!exists) {
        hideStatusPanel();
        return;
    }

    populateStatusPanel(structure);
}

function describeStructure(structure) {
    if (!structure) return DEFAULT_STATUS_DESCRIPTION;
    if (structure.type === 'tower') {
        return structure.upgradeLevel >= 2
            ? 'Advanced guardian tower that fires empowered radiant bolts at high speed.'
            : 'Guardian tower that fires radiant bolts at nearby enemies.';
    }
    return 'Reinforced stone wall that blocks and reroutes hostile units.';
}

function populateStatusPanel(structure) {
    if (!structure) return;
    if (structure.type === 'tower') {
        statusTitle.textContent = structure.upgradeLevel >= 2 ? 'Guardian Tower · Advanced' : 'Guardian Tower · Basic';
        statusHealth.textContent = `${Math.ceil(structure.hitPoints)} / ${structure.maxHitPoints}`;
        statusDamage.textContent = structure.damage.toString();
        const attacksPerSecond = (1 / structure.fireInterval).toFixed(1);
        statusSpeed.textContent = `${attacksPerSecond}/s`;
        statusEffect.textContent = structure.upgradeLevel === 1 ? 'None' : 'Advanced';
        statusDescription.textContent = describeStructure(structure);
        upgradeBtn.disabled = structure.upgradeLevel >= 2 || gameState.gold < 150;
        upgradeBtn.textContent = structure.upgradeLevel >= 2 ? 'Max Level' : 'Upgrade (150g)';
    } else if (structure.type === 'wall') {
        statusTitle.textContent = 'Stone Wall';
        statusHealth.textContent = `${Math.ceil(structure.hitPoints)} / ${structure.maxHitPoints}`;
        statusDamage.textContent = '—';
        statusSpeed.textContent = '—';
        statusEffect.textContent = '—';
        statusDescription.textContent = describeStructure(structure);
        upgradeBtn.disabled = true;
        upgradeBtn.textContent = 'N/A';
    }
}

function showStatusPanel(structure) {
    if (!structure) return;
    gameState.selectedStructure = structure;
    statusPanel.classList.remove('hidden');
    populateStatusPanel(structure);
}

function hideStatusPanel() {
    statusPanel.classList.add('hidden');
    gameState.selectedStructure = null;
    statusTitle.textContent = 'Structure Status';
    statusHealth.textContent = '-';
    statusDamage.textContent = '-';
    statusSpeed.textContent = '-';
    statusEffect.textContent = '-';
    statusDescription.textContent = DEFAULT_STATUS_DESCRIPTION;
    upgradeBtn.disabled = true;
    upgradeBtn.textContent = 'Upgrade (150g)';
}

function upgradeStructure() {
    const structure = gameState.selectedStructure;
    if (!structure || structure.type !== 'tower' || structure.upgradeLevel >= 2) return;
    if (gameState.gold < 150) {
        window.alert('Not enough gold.');
        return;
    }

    gameState.gold -= 150;
    structure.upgradeLevel = 2;
    structure.damage = 8;
    structure.fireInterval = 0.45;
    structure.maxHitPoints = 20;
    structure.hitPoints = Math.min(structure.hitPoints + 6, structure.maxHitPoints);

    populateStatusPanel(structure);
    updateUI();
}

function demolishStructure() {
    const structure = gameState.selectedStructure;
    if (!structure) return;

    if (structure.type === 'tower') {
        const index = gameState.towers.indexOf(structure);
        if (index !== -1) {
            gameState.towers.splice(index, 1);
        }
        if (structure.mesh) {
            removeStructureHealthBar(structure.mesh);
            structure.healthBar = null;
            scene.remove(structure.mesh);
            structure.mesh = null;
        }
        const tile = gameState.terrain[structure.y]?.[structure.x];
        if (tile) {
            tile.walkable = true;
            tile.occupied = false;
        }
        gameState.gold += 50;
    } else if (structure.type === 'wall') {
        const index = gameState.walls.indexOf(structure);
        if (index !== -1) {
            gameState.walls.splice(index, 1);
        }
        if (structure.mesh) {
            removeStructureHealthBar(structure.mesh);
            structure.healthBar = null;
            scene.remove(structure.mesh);
            structure.mesh = null;
        }
        const tile = gameState.terrain[structure.y]?.[structure.x];
        if (tile) {
            tile.walkable = true;
            tile.occupied = false;
        }
        gameState.gold += 25;
    }

    hideStatusPanel();
    updateUI();
}

function placeTower(tile) {
    const towerGroup = new THREE.Group();

    const foundation = new THREE.Mesh(new THREE.CylinderGeometry(3.6, 4.2, 1.4, 16), materials.towerTrim);
    foundation.castShadow = true;
    foundation.receiveShadow = true;
    foundation.position.y = 0.7;

    const column = new THREE.Mesh(new THREE.CylinderGeometry(3.2, 3.4, 6.8, 16), materials.tower);
    column.castShadow = true;
    column.receiveShadow = true;
    column.position.y = 4.1;

    const battlement = new THREE.Mesh(new THREE.BoxGeometry(7, 2.2, 7), materials.towerTrim);
    battlement.castShadow = true;
    battlement.receiveShadow = true;
    battlement.position.y = 7.8;

    const crenel = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.6, 1.4), materials.tower);
    crenel.castShadow = true;
    crenel.receiveShadow = true;
    const offsets = [
        [-2.3, 0, -2.3],
        [2.3, 0, -2.3],
        [-2.3, 0, 2.3],
        [2.3, 0, 2.3],
        [0, 0, -2.3],
        [-2.3, 0, 0],
        [2.3, 0, 0],
        [0, 0, 2.3]
    ];
    offsets.forEach(([x, y, z]) => {
        const c = crenel.clone();
        c.position.set(x, battlement.position.y + 1.1 + y, z);
        towerGroup.add(c);
    });

    const runeGeometry = new THREE.PlaneGeometry(3.6, 5.2);
    const runeMaterial = materials.towerRune.clone();
    runeMaterial.transparent = true;
    runeMaterial.side = THREE.DoubleSide;
    runeMaterial.opacity = 0.9;
    const rune = new THREE.Mesh(runeGeometry, runeMaterial);
    rune.renderOrder = 2000;
    rune.position.set(0, 4.5, 3.1);

    const runeBack = rune.clone();
    runeBack.position.z = -3.1;
    runeBack.rotation.y = Math.PI;

    towerGroup.add(foundation);
    towerGroup.add(column);
    towerGroup.add(battlement);
    towerGroup.add(rune);
    towerGroup.add(runeBack);

    const pos = gridToWorld(tile.x, tile.y, 0);
    towerGroup.position.set(pos.x, pos.y, pos.z);

    scene.add(towerGroup);

    tile.walkable = false;
    tile.occupied = 'tower';

    const towerData = {
        x: tile.x,
        y: tile.y,
        mesh: towerGroup,
        world: pos.clone().add(new THREE.Vector3(0, battlement.position.y + 1.2, 0)),
        range: TILE_WORLD_SIZE * 5,
        damage: 5,
        fireInterval: 0.6,
        cooldown: 0,
        projectileSpeed: 42,
        hitPoints: 14,
        maxHitPoints: 14,
        healthBar: null,
        upgradeLevel: 1,
        type: 'tower'
    };
    gameState.towers.push(towerData);

    const towerHeightOffset = battlement.position.y + 1.9;
    towerData.healthBar = addStructureHealthBar(
        towerGroup,
        () => towerData.hitPoints,
        () => towerData.maxHitPoints,
        { width: 4.2, height: 0.28, offset: towerHeightOffset }
    );
}

function placeWall(tile) {
    const wallHeight = 4.8;
    const wallGroup = new THREE.Group();

    const baseGeometry = new THREE.BoxGeometry(TILE_WORLD_SIZE * 1.18, 1.2, TILE_WORLD_SIZE * 1.18);
    const base = new THREE.Mesh(baseGeometry, materials.wallTrim);
    base.castShadow = true;
    base.receiveShadow = true;
    base.position.y = 0.6;

    const bodyGeometry = new THREE.BoxGeometry(TILE_WORLD_SIZE * 1.1, wallHeight - 1.2, TILE_WORLD_SIZE * 0.9);
    const body = new THREE.Mesh(bodyGeometry, materials.wall);
    body.castShadow = true;
    body.receiveShadow = true;
    body.position.y = 1.2 + (wallHeight - 1.2) / 2;

    const crenelGeometry = new THREE.BoxGeometry(TILE_WORLD_SIZE * 0.32, 1.2, TILE_WORLD_SIZE * 0.9);
    const crenel = new THREE.Mesh(crenelGeometry, materials.wallTrim);
    crenel.castShadow = true;
    crenel.receiveShadow = true;
    const spacing = TILE_WORLD_SIZE * 0.38;
    for (let i = -1; i <= 1; i += 1) {
        if (i === 0) continue;
        const c = crenel.clone();
        c.position.set(i * spacing, wallHeight + 0.3, 0);
        wallGroup.add(c);
    }

    const centerCrenel = crenel.clone();
    centerCrenel.position.set(0, wallHeight + 0.3, 0);
    wallGroup.add(centerCrenel);

    wallGroup.add(base);
    wallGroup.add(body);

    const pos = gridToWorld(tile.x, tile.y, 0);
    wallGroup.position.set(pos.x, pos.y, pos.z);

    scene.add(wallGroup);

    tile.walkable = false;
    tile.occupied = 'wall';

    const wallData = {
        x: tile.x,
        y: tile.y,
        mesh: wallGroup,
        healthBar: null,
        hitPoints: 10,
        maxHitPoints: 10,
        type: 'wall'
    };
    gameState.walls.push(wallData);

    wallData.healthBar = addStructureHealthBar(
        wallGroup,
        () => wallData.hitPoints,
        () => wallData.maxHitPoints,
        { width: 3.2, height: 0.24, offset: wallHeight + 1.4 }
    );
}

function spawnMonster() {
    const path = gameState.path;
    if (!path.length) return;

    const startPoint = path[0];
    const spawnWorld = gridToWorld(startPoint.x, Math.max(startPoint.y - 2, 0), 0.6);
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

function createHealthBar({ width = 2.4, height = 0.22, backgroundPadding = 0.2 } = {}) {
    const group = new THREE.Group();

    const backgroundGeometry = new THREE.PlaneGeometry(width + backgroundPadding, height + backgroundPadding * 0.6);
    const backgroundMaterial = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.6, depthTest: false });
    const background = new THREE.Mesh(backgroundGeometry, backgroundMaterial);
    background.renderOrder = 1000;

    const fillGeometry = new THREE.PlaneGeometry(width, height);
    const fillMaterial = new THREE.MeshBasicMaterial({ color: 0x4cff4c, transparent: true, opacity: 0.9, depthTest: false });
    const fill = new THREE.Mesh(fillGeometry, fillMaterial);
    fill.position.z = 0.01;
    fill.renderOrder = 1001;

    group.add(background);
    group.add(fill);

    return { group, fill, width };
}

function addStructureHealthBar(target, getCurrent, getMax, { width = 3.6, height = 0.26, offset = 0 } = {}) {
    const healthBar = createHealthBar({ width, height, backgroundPadding: 0.3 });
    healthBar.group.position.set(0, offset, 0);
    target.add(healthBar.group);
    gameState.structureBars.push({
        target,
        bar: healthBar,
        getCurrent,
        getMax
    });
    return healthBar;
}

function removeStructureHealthBar(target) {
    gameState.structureBars = gameState.structureBars.filter((entry) => {
        if (entry.target === target) {
            if (entry.bar?.group?.parent) {
                entry.bar.group.parent.remove(entry.bar.group);
            }
            return false;
        }
        return true;
    });
}

function updateStructureHealthBar(entry) {
    const { bar, getCurrent, getMax, target } = entry;
    if (!bar || !bar.fill || !target) return;
    const current = THREE.MathUtils.clamp(getCurrent(), 0, getMax());
    const ratio = THREE.MathUtils.clamp(getMax() === 0 ? 0 : current / getMax(), 0, 1);
    const halfWidth = (bar.width ?? 2.4) / 2;

    bar.fill.scale.x = ratio;
    bar.fill.position.x = -halfWidth + ratio * halfWidth;
    if (ratio > 0.6) {
        bar.fill.material.color.set(0x4cff4c);
    } else if (ratio > 0.3) {
        bar.fill.material.color.set(0xffc107);
    } else {
        bar.fill.material.color.set(0xff4c4c);
    }
    bar.group.visible = ratio > 0 ? true : false;
    bar.group.quaternion.copy(camera.quaternion);
}

function updateStructureHealthBars() {
    for (const entry of gameState.structureBars) {
        updateStructureHealthBar(entry);
    }
}

function updateMonsterHealthBar(monster) {
    if (!monster.healthBar) return;
    const { group, fill, width } = monster.healthBar;
    const ratio = THREE.MathUtils.clamp(monster.health / monster.maxHealth, 0, 1);

    fill.scale.x = ratio;
    const halfWidth = (width ?? 2.4) / 2;
    fill.position.x = -halfWidth + ratio * halfWidth;
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
    if (!player.mesh) return;

    const joystickActive = player.joystickInput.lengthSq() > 0.01;
    if (joystickActive) {
        player.target = null;
        const direction = new THREE.Vector3(player.joystickInput.x, 0, -player.joystickInput.y);
        if (direction.lengthSq() === 0) return;
        direction.normalize();
        const move = player.speed * delta;
        const next = player.world.clone().add(direction.multiplyScalar(move));
        next.y = player.world.y;
        if (isWalkableWorldPosition(next)) {
            player.world.copy(next);
            player.mesh.position.copy(player.world);
            player.grid = worldToGrid(player.world);
            facePlayerTowards(player.world.clone().add(direction));
        }
        return;
    }

    if (!player.target) return;

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
    player.world.add(direction);
    player.world.y = targetWorld.y;
    player.mesh.position.copy(player.world);
}

function updateMonsters(delta) {
    for (let i = gameState.monsters.length - 1; i >= 0; i -= 1) {
        const monster = gameState.monsters[i];
        if (!monster.targetWorld || !monster.mesh) continue;

        const direction = monster.targetWorld.clone().sub(monster.world);
        const distance = direction.length();
        const travel = monster.speed * delta;

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
    updateStructureHealthBars();
    refreshStatusPanel();
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

function worldToGrid(worldVec) {
    const offset = (MAP_SIZE * TILE_WORLD_SIZE) / 2;
    const x = Math.round((worldVec.x + offset - TILE_WORLD_SIZE / 2) / TILE_WORLD_SIZE);
    const y = Math.round((worldVec.z + offset - TILE_WORLD_SIZE / 2) / TILE_WORLD_SIZE);
    return { x, y };
}

function isWalkableWorldPosition(worldVec) {
    const { x, y } = worldToGrid(worldVec);
    const tile = gameState.terrain[y]?.[x];
    return !!(tile && tile.walkable && !tile.occupied);
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


