const caveShaderParams = {

    scale: 1,
    textureSwapScale: 150,
    textureSwapBlend: 5,
    fullBright: 0,
    gridShown: 0,

};

import * as THREE from 'three';

import Stats from './stats.module.js';

import { GUI } from './lil-gui.module.min.js';
import { CaveGen } from './cave-gen.js';
import { Player } from './movement.js';
import { OBJLoader } from './jsm/loaders/OBJLoader.js';
import * as CaveMaterial from './caveMaterial.js';

////////////////////////
////////BLOOM///////////
////////////////////////
import { EffectComposer } from './jsm/postprocessing/EffectComposer.js';
import { RenderPass } from './jsm/postprocessing/RenderPass.js';
import { ShaderPass } from './jsm/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from './jsm/postprocessing/UnrealBloomPass.js';
const ENTIRE_SCENE = 0, BLOOM_SCENE = 1;

const bloomLayer = new THREE.Layers();
bloomLayer.set( BLOOM_SCENE );
const launchedLights = [];

const params = {
    exposure: 5,
    bloomStrength: 3,
    bloomThreshold: 0,
    bloomRadius: 0.2,
    hand_light_distance: 15,
    throw_light_distance: 25,
    throw_light_lifetime: 600,
    throw_light_size: 0.3,
    hue: Math.random(), 
    lightness: 0.2,
    light_charge_speed: 1,
    scene: 'Scene with Glow'
};

const darkMaterial = new THREE.MeshBasicMaterial( { color: 'black' } );
const materials = {};
////////////////////////
////////////////////////
////////////////////////

let container, gui, stats;

let camera, scene, renderer;

let spotLight, pointLight;

let caveGen;

let triplanarMat;

let player;

const clock = new THREE.Clock();

const objLoader = new OBJLoader();
const audioLoader = new THREE.AudioLoader();
const texLoader = new THREE.TextureLoader();

const sounds = {};

const caveScale = 20;
const caveNoiseScale = 0.5;
const caveResolution = 8;

// Group to store the launch lights in the scene
const pooledLaunchLights = new THREE.Group();

const mainOreGroup = new THREE.Group();
// Group that stores ores that are being animated out of existence
const minedOreGroup = new THREE.Group();
// Most recently hit ore
let bumpedOre;
let collectedOreCount = 0;
let oreCounter = document.getElementById("oreCount");

const caveChunkSize = (1 - 3/caveResolution) * caveScale * 2;

const collidible = new THREE.Group();

let playerChunkPos = new THREE.Vector3();

let renderScene, bloomPass, bloomComposer, finalPass, finalComposer;
let sphere_color, sphere, sphere_geometry, sphere_material;

let rockTex, rockNorm, rockTex2, rockNorm2, gemNorm, gemRough;

let orbChargeTime = 0;
let rmbHeld = false;

function disposeMaterial( obj ) {
    if ( obj.material ) {
        obj.material.dispose();
    }
}

function render() {


    switch ( params.scene ) {

        case 'Scene only':
            renderer.render( scene, camera );
            break;
        case 'Glow only':
            renderBloom( false );
            break;
        case 'Scene with Glow':
        default:
            // render scene with bloom
            renderBloom( true );

            // render the entire scene, then render bloom scene on top
            finalComposer.render();
            break;

    }

}

function renderBloom( mask ) {

    if ( mask === true ) {

        scene.traverse( darkenNonBloomed );
        bloomComposer.render();
        scene.traverse( restoreMaterial );

    } else {

        camera.layers.set( BLOOM_SCENE );
        bloomComposer.render();
        camera.layers.set( ENTIRE_SCENE );

    }

}

function darkenNonBloomed( obj ) {

    if ( obj.isMesh && bloomLayer.test( obj.layers ) === false ) {

        materials[ obj.uuid ] = obj.material;
        obj.material = darkMaterial;

    }

}

function restoreMaterial( obj ) {

    if ( materials[ obj.uuid ] ) {

        obj.material = materials[ obj.uuid ];
        delete materials[ obj.uuid ];

    }
}

function loadModel(url) {
    return new Promise(resolve => {
      objLoader.load(url, resolve);
    });
}

function loadAudio(url) {
    return new Promise(resolve => {
      audioLoader.load(url, resolve);
    });
}

function loadTexture(url) {
    return new Promise(resolve => {
        texLoader.load(url, resolve);
    });
}

const listener = new THREE.AudioListener();
const ambienceAudio = new THREE.Audio( listener );
const windAudio = new THREE.Audio( listener );
const wallSlideAudio = new THREE.Audio( listener );
const orbChargeAudio = new THREE.Audio( listener );
const audioPlayerPool = [];
// Generates a pool of audio players to use
for (let i = 0; i < 16; i++) {
    audioPlayerPool.push(new THREE.Audio( listener ));
}

const majorNotes = [-1200. -800, -500, 0, 400, 700, 1200];
const minorNotes = [-1200, -900, -500, 0, 300, 700, 1200];

function playSound(soundBuffer, volume, detune) {
    let i = 1;
    let sound = audioPlayerPool[0];
    while (sound.isPlaying && i < audioPlayerPool.length) {
        sound = audioPlayerPool[i++];
    }
    if (sound.isPlaying) {
        sound.stop();
    }
    sound.setBuffer( soundBuffer );
    sound.setVolume( volume );
    sound.play();
    if (detune !== undefined) sound.setDetune( detune );
    else sound.setDetune( 0 );
}

let audioLoopsStarted = false;

function startAudioLoops() {
    if (audioLoopsStarted) return;
    audioLoopsStarted = true;
    ambienceAudio.play();
    windAudio.play();
    wallSlideAudio.play();
    orbChargeAudio.play();
}

function updateSphereColor() {
    sphere_color.setHSL(params.hue, 0.7, params.lightness);
    sphere_material.color.setHSL(params.hue, 0.7, params.lightness * 0.5);
    sphere_material.color.multiplyScalar(1.5 + Math.sin(clock.elapsedTime * 3) * 0.3);

    pointLight.color = sphere_color;
}

init();

async function init() {

    container = document.getElementById( 'container' );
    gui = document.getElementById( 'gui' );

    // SCENE

    scene = new THREE.Scene();
    scene.background = new THREE.Color( 0x050505 );

    scene.add( collidible );

    //PLAYER MOVEMENT

    player = new Player(scene, collidible);
    camera = player.camera;
    scene.add(camera);

    // LIGHTS

    spotLight = new THREE.SpotLight( 0xffffff, 1, 70, 1, 0.5, 2 );
    scene.add( spotLight );
    camera.add(spotLight.target);
    spotLight.target.position.set(0, 0, -1);

    scene.fog = new THREE.Fog(new THREE.Color('#000'), 70, 80);
    scene.background = new THREE.Color('#000');

    // MATERIALS

    const loadPromises2 = [];

    loadPromises2.push(loadTexture('../images/rocks.jpg').then(result => {
        rockTex = result;
    }));

    loadPromises2.push(loadTexture('../images/rock-normal.jpg').then(result => {
        rockNorm = result;
    }));

    loadPromises2.push(loadTexture('../images/rockTex2.jpg').then(result => {
        rockTex2 = result;
    }));

    loadPromises2.push(loadTexture('../images/rockNorm2.jpg').then(result => {
        rockNorm2 = result;
    }));

    loadPromises2.push(loadTexture('../images/gemNormal.jpg').then(result => {
        gemNorm = result;
    }));

    loadPromises2.push(loadTexture('../images/gemRough.jpg').then(result => {
        gemRough = result;
    }));

    await Promise.all(loadPromises2);

    triplanarMat = CaveMaterial.getMaterial(rockTex, rockNorm, rockTex2, rockNorm2);

    const oreMat = new THREE.MeshPhysicalMaterial({ 
        color: '#ff0000', 
        emissive: '#ff0000', 
        emissiveIntensity: 0.1, 
        roughness: 1,
        roughnessMap: gemRough,
        opacity: 0, 
        transmission: 0.8, 
        reflectivity: 0.5, 
        sheen: 0.2, 
        sheenColor: '#fff',
        sheenRoughness: 0.1,
        normalMap: gemNorm,
        normalScale: new THREE.Vector2(5, 5)
    });
    const stoneMat = new THREE.MeshStandardMaterial({ 
        color: '#ddd', 
        metalness: 0.3,
        map: rockTex,
        normalMap: rockNorm
     });

    // LOAD MODELS

    const loadPromises = [];

    let oreModel;
    loadPromises.push(loadModel('../models/OreNode2.obj').then(result => {
        oreModel = result;
        
        oreModel.traverse( function( child ) {
            if ( child instanceof THREE.Mesh ) {
                if (child.name !== 'Icosphere')
                    child.material = oreMat;
                else 
                    child.material = stoneMat;
            }
        });
    }));
    
    // LOAD SOUNDS

    camera.add( listener );

    loadPromises.push(loadAudio('../audio/gemHum.mp3').then(result => {
        sounds.gemHum = result;
    }));

    loadPromises.push(loadAudio('../audio/mineralHit.wav').then(result => {
        sounds.mineralHit = result;
    }));

    loadPromises.push(loadAudio('../audio/mineralBreak.wav').then(result => {
        sounds.mineralBreak = result;
    }));

    loadPromises.push(loadAudio('../audio/wallHit.mp3').then(result => {
        sounds.wallHit = result;
    }));

    loadPromises.push(loadAudio('../audio/orbLaunch.wav').then(result => {
        sounds.orbLaunch = result;
    }));

    loadPromises.push(loadAudio('../audio/orbHum.wav').then(result => {
        sounds.orbHum = result;
    }));

    loadPromises.push(loadAudio('../audio/ambience.mp3').then(result => {
        sounds.ambience = result;
    }));

    loadPromises.push(loadAudio('../audio/wind.mp3').then(result => {
        sounds.wind = result;
    }));

    loadPromises.push(loadAudio('../audio/wallSlide.mp3').then(result => {
        sounds.wallSlide = result;
    }));

    await Promise.all(loadPromises);

    ambienceAudio.setBuffer( sounds.ambience );
    ambienceAudio.setVolume( 0.1 );
    ambienceAudio.setLoop(true);

    windAudio.setBuffer( sounds.wind );
    windAudio.setVolume( 0 );
    windAudio.setLoop(true);

    wallSlideAudio.setBuffer( sounds.wallSlide );
    wallSlideAudio.setVolume( 0 );
    wallSlideAudio.setLoop(true);

    orbChargeAudio.setBuffer( sounds.orbHum );
    orbChargeAudio.setVolume( 0 );
    orbChargeAudio.setLoop(true);

    // MARCHING CUBES
    
    caveGen = new CaveGen(scene, collidible, caveScale, caveNoiseScale, caveResolution, triplanarMat, oreModel, mainOreGroup);
    scene.add(mainOreGroup, minedOreGroup);

    // RENDERER

    renderer = new THREE.WebGLRenderer();
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.setPixelRatio( window.devicePixelRatio );
    renderer.setSize( window.innerWidth, window.innerHeight );
    container.appendChild( renderer.domElement );

    // BLOOM

    renderScene = new RenderPass( scene, camera );

    bloomPass = new UnrealBloomPass( new THREE.Vector2( window.innerWidth, window.innerHeight ), 1.5, 0.4, 0.85 );
    bloomPass.threshold = params.bloomThreshold;
    bloomPass.strength = params.bloomStrength;
    bloomPass.radius = params.bloomRadius;

    bloomComposer = new EffectComposer( renderer );
    bloomComposer.renderToScreen = false;
    bloomComposer.addPass( renderScene );
    bloomComposer.addPass( bloomPass );

    finalPass = new ShaderPass(
        new THREE.ShaderMaterial( {
            uniforms: {
                baseTexture: { value: null },
                bloomTexture: { value: bloomComposer.renderTarget2.texture }
            },
            vertexShader: document.getElementById( 'vertexshader' ).textContent,
            fragmentShader: document.getElementById( 'fragmentshader' ).textContent,
            defines: {}
        } ), 'baseTexture'
    );
    finalPass.needsSwap = true;

    finalComposer = new EffectComposer( renderer );
    finalComposer.addPass( renderScene );
    finalComposer.addPass( finalPass );

    sphere_geometry = new THREE.SphereGeometry( 1, 15 );

    sphere_color = new THREE.Color();

    sphere_material = new THREE.MeshBasicMaterial( { color: sphere_color, side: THREE.DoubleSide, fog: false } );
    sphere = new THREE.Mesh( sphere_geometry, sphere_material );
    sphere.position.set(1.3, -0.7, -1);
    camera.add( sphere );

    sphere.layers.enable( BLOOM_SCENE );

    pointLight = new THREE.PointLight( sphere_color, 5, 20 );
    pointLight.intensity = 1;
    sphere.add( pointLight );

    updateSphereColor();

    // SETUP LAUNCH LIGHT POOL

    const launch_sphere = new THREE.Mesh( sphere_geometry, sphere_material );
    launch_sphere.material = launch_sphere.material.clone();
    launch_sphere.material.color = sphere_color.clone();
    launch_sphere.layers.enable( BLOOM_SCENE );
    launch_sphere.scale.setScalar(0);

    const launch_light = new THREE.PointLight( sphere_color, 0, params.throw_light_distance);
    launch_light.position.set(0, 0, -5);
    launch_sphere.add(launch_light);

    for (let i = 0; i < 8; i++) {
        const llClone = launch_sphere.clone();
        llClone.material = launch_sphere.material.clone();
        llClone.material.color = sphere_color.clone();

        llClone.age = 0;
        llClone.velocity = new THREE.Vector3();

        pooledLaunchLights.add(llClone);
    }

    scene.add(pooledLaunchLights);

    // STATS

    stats = new Stats();
    gui.appendChild( stats.dom );

    // GUI

    setupGui();

    // EVENTS

    window.addEventListener( 'resize', onWindowResize );

    container.addEventListener( 'mousedown', () => {

        document.body.requestPointerLock();

    } );

    document.addEventListener("mousedown", (event) => {
        if (document.pointerLockElement === document.body) {
            if (event.button === 0) tryMineGem();
            else if (event.button === 2) rmbHeld = true;
        }
    });

    document.addEventListener("mouseup", (event) => {
        if (document.pointerLockElement === document.body) {
            if (event.button === 2) {
                tryLaunchSphere();
                rmbHeld = false;
            }
        }
    });

    await caveGen.generateAround(0, 0, 0);

    // MOVE PLAYER TO INSIDE CAVE

    const seg = caveGen.segments.find((seg) => seg.x == 0 && seg.y == 0 && seg.z == 0);
    const posArray = seg.mc.geometry.getAttribute("position").array;
    const normArray = seg.mc.geometry.getAttribute("normal").array;

    for (let i = 0; i < posArray.length; i+=3) {
        const x = posArray[i + 0];
        const y = posArray[i + 1];
        const z = posArray[i + 2];

        if (!(x == 0 && y == 0 && z == 0)) {
            const pos = new THREE.Vector3(x * caveScale, y * caveScale, z * caveScale);

            const nx = normArray[i + 0];
            const ny = normArray[i + 1];
            const nz = normArray[i + 2];

            pos.addScaledVector((new THREE.Vector3(nx, ny, nz)).normalize(), 10);

            camera.position.copy(pos);

            break;
        }
    }

    player.checkCollisions = true;
    
    document.addEventListener('click', () => startAudioLoops());

    clock.start();
    animate();
}

function setupGui() {

    let h;
    let hh;

    const gui = new GUI();

    // simulation

    h = gui.addFolder( 'Cave Shader Parameters' );

    h.add( caveShaderParams, 'scale', 0, 5);

    h.add( caveShaderParams, 'textureSwapScale', 0.3, 1000);

    h.add( caveShaderParams, 'textureSwapBlend', 0.1, 50);

    h.add( caveShaderParams, 'fullBright', 0, 1);

    h.add( caveShaderParams, 'gridShown', 0, 1);

    // h.add( caveParams, 'resolution', 14, 100, 1 );

    // h.add( caveParams, 'segmentX');
    // h.add( caveParams, 'segmentY');
    // h.add( caveParams, 'segmentZ');
    // h.add( caveParams, 'genSeg');


    hh = gui.addFolder( 'Bloom Parameters' );
    hh.add( params, 'bloomThreshold', 0.0, 1.0 ).onChange( function ( value ) {
    
        bloomPass.threshold = Number( value );
        render();
    
    } );
    hh.add( params, 'bloomStrength', 0.0, 10.0 ).onChange( function ( value ) {
    
        bloomPass.strength = Number( value );
        render();
    
    } );
    hh.add( params, 'bloomRadius', 0.0, 1.0 ).step( 0.01 ).onChange( function ( value ) {
    
        bloomPass.radius = Number( value );
        render();
    
    } );
    hh.add( params, 'hand_light_distance', 10, 300 ).step( 10 );
    hh.add( params, 'throw_light_distance', 10, 300 ).step( 10 );
    hh.add( params, 'throw_light_lifetime', 100, 1000 ).step( 10 );
    
    hh.add( params, 'hue', 0, 1 ).step( 0.01 ).onChange( function ( value ) {
    
        updateSphereColor();
    
    } );
    hh.add( params, 'lightness', 0, 0.5 ).step( 0.01 ).onChange( function ( value ) {
    
        updateSphereColor();
    
    } );
    hh.add( params, 'light_charge_speed', 0.5, 2 );

    hh.add( params, 'scene', [ 'Scene with Glow', 'Glow only', 'Scene only' ] ).onChange( function ( value ) {

        switch ( value ) 	{
    
            case 'Scene with Glow':
                bloomComposer.renderToScreen = false;
                break;
            case 'Glow only':
                bloomComposer.renderToScreen = true;
                break;
            case 'Scene only':
                // nothing to do
                break;
    
        }
        render();
    });
    h.close();
    hh.close();
    gui.close();
}

function onWindowResize() {

    const width = window.innerWidth;
    const height = window.innerHeight;

    camera.aspect = width / height;
    camera.updateProjectionMatrix();

    renderer.setSize( window.innerWidth, window.innerHeight );

    bloomComposer.setSize( width, height );
    finalComposer.setSize( width, height );
}

function animate() {

    requestAnimationFrame( animate );

    // if (caveGen.octreesUpdated) {
    //     player.chunkOctrees = caveGen.getOctrees();
    //     caveGen.octreesUpdated = false;
    // }

    const deltaTime = clock.getDelta();

    player.updatePhysics();

    const pos = new THREE.Vector3(Math.round(camera.position.x / caveChunkSize), Math.round(camera.position.y / caveChunkSize), Math.round(camera.position.z / caveChunkSize));

    if (!pos.equals(playerChunkPos)) {
        caveGen.generateAround(pos.x, pos.y, pos.z);
        console.log("Generating chunks");
        playerChunkPos = pos;
    }

    triplanarMat.uniforms.scale.value = caveShaderParams.scale * 0.04;
    triplanarMat.uniforms.textureSwapScale.value = 1/caveShaderParams.textureSwapScale;
    triplanarMat.uniforms.textureSwapBlend.value = caveShaderParams.textureSwapBlend;
    triplanarMat.uniforms.gridShown.value = caveShaderParams.gridShown;
    triplanarMat.uniforms.fullBright.value = caveShaderParams.fullBright;

    updateSphereColor();

    // Animation of mined ores

    let minedToRemove = [];

    minedOreGroup.children.forEach(child => {
        child.minedAge += 0.1;
        child.scale.multiplyScalar(1.1 - (child.minedAge/4));
        child.position.addVectors(child.basePosition, new THREE.Vector3().randomDirection().multiplyScalar(Math.max((1.5 - (child.minedAge))*0.2, 0)));
        if (child.minedAge >= 1.5) {
            minedToRemove.push(child);
        }
    })

    minedToRemove.forEach(child => minedOreGroup.remove(child));

    if (bumpedOre != null) {
        bumpedOre.bumpTime += 0.1;
        bumpedOre.position.addVectors(bumpedOre.basePosition, new THREE.Vector3().randomDirection().multiplyScalar(Math.max((1.5 - (bumpedOre.bumpTime))*0.1 * bumpedOre.timesHit, 0)));
        if (bumpedOre.bumpTime >= 1.5) {
            bumpedOre = null;
        }
    }

    // Sound
    windAudio.setVolume(Math.min(1, player.playerSpeed / 30));
    wallSlideAudio.setVolume(player.wallSlideVolume);

    if(player.wallHitSoundQueued > 0) {
        playSound(sounds.wallHit, player.wallHitSoundQueued * 2);
        player.wallHitSoundQueued = 0;
    }

    spotLight.position.copy(camera.position);
    // spherePos();
    updateLaunch()
    render();
    stats.update();

    orbChargeTime = Math.max(0, Math.min(1, orbChargeTime + (rmbHeld ? deltaTime : -deltaTime * 2)));

    pointLight.distance = params.hand_light_distance;
    pointLight.intensity = orbChargeTime * 5;

    if (audioLoopsStarted) {
        orbChargeAudio.setVolume(Math.min(0.3, orbChargeTime));
        orbChargeAudio.setDetune(-1200 + Math.min(1, orbChargeTime * 1.3) * 1200);
    }

    sphere.scale.setScalar(easeOutBack(orbChargeTime) * 0.15);
    
}

function easeOutBack(x) {
    const c1 = 1.70158;
    const c3 = c1 + 1;
    
    return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
}

document.addEventListener("wheel", onDocumentScroll, false);
function onDocumentScroll(event) {
    if (event.deltaY < 0) {
        //console.log("up");
        params.hue += 0.1;
        updateSphereColor();
    }
    else if (event.deltaY > 0) {
        //console.log("down");
        params.hue -= 0.1;
        updateSphereColor();
    }
}

const raycaster = new THREE.Raycaster();
raycaster.far = 15;

function tryLaunchSphere() {
    if (orbChargeTime > 0.4) {
        
        const launch_sphere = pooledLaunchLights.children.find(x => x.age == 0);

        if (launch_sphere == null) {
            console.log("Not enough spheres in pool to launch a new one!");
            return;
        }
        
        console.log("Launched a new light orb!");
        
        orbChargeTime = 0;

        playSound(sounds.orbLaunch, 0.3);

        launch_sphere.material.color.copy(sphere_color);
        sphere.getWorldPosition(launch_sphere.position);
        launch_sphere.scale.setScalar(params.throw_light_size);

        // Assumes first child is the point light
        launch_sphere.children[0].intensity = 5;
        launch_sphere.children[0].color.copy(sphere_color);

        const humAudio = new THREE.PositionalAudio( listener );
        humAudio.setBuffer( sounds.orbHum );
        humAudio.setVolume( 0.3 );
        humAudio.setRefDistance( 1 );
        humAudio.setDistanceModel("exponential");
        humAudio.setLoop(true);
        launch_sphere.add(humAudio);
        humAudio.play();

        camera.getWorldDirection(launch_sphere.velocity);
        launch_sphere.lookAt(new THREE.Vector3().addVectors(launch_sphere.velocity, launch_sphere.position));

        launch_sphere.moving = true;
        launch_sphere.age = params.throw_light_lifetime;
        launchedLights.push(launch_sphere);
        
    }
}

function tryMineGem() {
    raycaster.setFromCamera(new THREE.Vector2(), camera);
    const intersects = raycaster.intersectObjects(mainOreGroup.children, true);
    if (intersects.length > 0) {
        const ore = intersects[0].object.parent;
        if (ore.timesHit === undefined) {
            ore.timesHit = 0;
            ore.basePosition = ore.position.clone();
        } 
        if (ore.timesHit < 2) {
            ore.timesHit++;
            bumpedOre = ore;
            bumpedOre.bumpTime = 0;
            playSound(sounds.mineralHit, 0.15);
            playSound(sounds.gemHum, 0.15, minorNotes[Math.floor(Math.random() * minorNotes.length)] - 1200);
        } else {
            ore.removeFromParent();
            ore.minedAge = 0;
            minedOreGroup.add(intersects[0].object.parent);
            playSound(sounds.mineralBreak, 0.15);
            playSound(sounds.gemHum, 0.15, minorNotes[Math.floor(Math.random() * minorNotes.length)] - 1200);
            collectedOreCount++;
            const oreCounterNew = oreCounter.cloneNode();
            oreCounter.parentNode.replaceChild(oreCounterNew, oreCounter);
            oreCounter = oreCounterNew;
            oreCounter.innerText = collectedOreCount;
        }
    }
}

const lightRaycaster = new THREE.Raycaster();
lightRaycaster.far = 2;

function updateLaunch() {
    launchedLights.forEach(lSphere => {
        if (lSphere.moving) {
            lightRaycaster.set(lSphere.position, lSphere.velocity);
            const intersects = lightRaycaster.intersectObjects(collidible.children);
            if (intersects.length > 0) {
                //lSphere.position.copy(intersects[0].point);
                lSphere.lookAt(intersects[0].point);
                lSphere.moving = false;
                lSphere.velocity.multiplyScalar(0.05);
            }
            lSphere.position.add(lSphere.velocity);
            // lSphere.position.add(new THREE.Vector3().copy(lSphere.velocity).multiplyScalar(Math.max(0, 2*lSphere.age/params.throw_light_lifetime - 1.8)));
        }
        lSphere.age--;
        lSphere.children[0].distance = Math.min(1, (lSphere.age / params.throw_light_lifetime) * 3) * params.throw_light_distance;
        
        // Update hum volume
        if (lSphere.age < 150) {
            lSphere.children[1].setVolume(0.3 * lSphere.age/150);
        }
        // Disappear into wall
        if (lSphere.age < 50) {
            lSphere.position.add(lSphere.velocity);
            // lSphere.scale.setScalar(lSphere.age/50 * params.throw_light_size);
        }
    });
    launchedLights.filter(x => x.age <= 0).forEach(old => {
        const index = launchedLights.indexOf(old);
        if (index > -1) launchedLights.splice(index, 1);

        old.children[0].distance = 0;
        old.children[0].intensity = 0;

        old.children[1].stop();
        old.remove(old.children[1]);
        
        old.scale.setScalar(0);
    })
}
