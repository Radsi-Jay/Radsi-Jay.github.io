let scene, camera, renderer;
let fadeMaterial, fadeMesh, fadeObject, fadeScene, fadeCam;
let controls;

// Adjustable parameters
let params = {
    pauseSim: false,
    showBounds: false,
    radius: 500,
    boundsFactor: 1,
    matchingFactor: 0.05,
    centeringFactor: 0.005,
    avoidFactor: 0.05,
    minDistance: 30,
    sightDist: 100,
    speed: 5,
    maxAccelleration: 0.5,
    numBoids: 1000,
    boidLength: 8,
    boidWidth: 3,
    afterimageEffect: true,
    afterimageAmount: 0.7
}

let prevLength = 1;
let prevWidth = 1;
let prevAfterimageEffect = !params.afterimageEffect;
let prevAfterimageAmount = -1;


let helperSphere;
let helperBox;

let boids = [];

let boidGeometry = new THREE.ConeGeometry( 2, 4, 16 );
boidGeometry.rotateX(Math.PI/2);

// Wraps negative values correctly
function mod(x, m) {
    let r = x%m;
    return r<0 ? r+m : r;
}

// Taken from https://stackoverflow.com/questions/36721830/convert-hsl-to-rgb-and-hex
function hslToHex(h, s, l) {
    l /= 100;
    const a = s * Math.min(l, 1 - l) / 100;
    const f = n => {
        const k = (n + h / 30) % 12;
        const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
        return Math.round(255 * color).toString(16).padStart(2, '0');   // convert to Hex and prefix "0" if needed
    };
    return `#${f(0)}${f(8)}${f(4)}`;
}

function distance(boid1, boid2) {
    return boid1.object.position.distanceTo(boid2.object.position);
}

// Make the boids move back inside the radius if they leave
function wallBounce(boid) {
    let pos = boid.object.position;

    if (pos.x > params.radius || pos.x < -params.radius) { boid.accellerate(-Math.sign(pos.x) * (Math.abs(pos.x) - params.radius) * params.boundsFactor, 0, 0); }
    if (pos.y > params.radius || pos.y < -params.radius) { boid.accellerate(0, -Math.sign(pos.y) * (Math.abs(pos.y) - params.radius) * params.boundsFactor, 0); }
    if (pos.z > params.radius || pos.z < -params.radius) { boid.accellerate(0, 0, -Math.sign(pos.z) * (Math.abs(pos.z) - params.radius) * params.boundsFactor); }
}

// I used a fairly modified version of this 2D boids algorithm
// https://github.com/beneater/boids/blob/master/boids.js

// Find the center of mass of the other boids and adjust velocity slightly to
// move towards the center of mass.
function flyTowardsCenter(boid) {
    let centerX = 0;
    let centerY = 0;
    let centerZ = 0;
    let numNeighbors = 0;
  
    for (let otherBoid of boids) {
      if (distance(boid, otherBoid) < params.sightDist) {
        centerX += otherBoid.object.position.x;
        centerY += otherBoid.object.position.y;
        centerZ += otherBoid.object.position.z;
        numNeighbors += 1;
      }
    }
  
    if (numNeighbors) {
        centerX = centerX / numNeighbors;
        centerY = centerY / numNeighbors;
        centerZ = centerZ / numNeighbors;
            
        let pos = boid.object.position;
        
        boid.accellerate((centerX - pos.x) * params.centeringFactor, 0, 0);
        boid.accellerate(0, (centerY - pos.y) * params.centeringFactor, 0);
        boid.accellerate(0, 0, (centerZ - pos.z) * params.centeringFactor);
    }
}
  
// Move away from other boids that are too close to avoid colliding
function avoidOthers(boid) {
    let moveX = 0;
    let moveY = 0;
    let moveZ = 0;

    const pos = boid.object.position;

    for (let otherBoid of boids) {
        if (otherBoid !== boid) {
            const otherPos = otherBoid.object.position;
            if (distance(boid, otherBoid) < params.minDistance) {
                moveX += pos.x - otherPos.x;
                moveY += pos.y - otherPos.y;
                moveZ += pos.z - otherPos.z;
            }
        }
    }

    boid.accellerate(moveX * params.avoidFactor, 0, 0);
    boid.accellerate(0, moveY * params.avoidFactor, 0);
    boid.accellerate(0, 0, moveZ * params.avoidFactor);
}

// Copy the velocity of nearby boids
function matchVelocity(boid) {
    let avgVX = 0;
    let avgVY = 0;
    let avgVZ = 0;
    let numNeighbors = 0;
  
    for (let otherBoid of boids) {
      if (distance(boid, otherBoid) < params.sightDist) {
        avgVX += otherBoid.velocity.x;
        avgVY += otherBoid.velocity.y;
        avgVZ += otherBoid.velocity.z;
        numNeighbors += 1;
      }
    }
  
    if (numNeighbors) {
      avgVX = avgVX / numNeighbors;
      avgVY = avgVY / numNeighbors;
      avgVZ = avgVZ / numNeighbors;
  
      boid.accellerate(avgVX * params.matchingFactor, 0, 0);
      boid.accellerate(0, avgVY * params.matchingFactor, 0);
      boid.accellerate(0, 0, avgVZ * params.matchingFactor);
    }
}

function combinedBrain(boid) {
    // Fly to Center
    let centerX = 0;
    let centerY = 0;
    let centerZ = 0;
    
    // Avoid others
    let moveX = 0;
    let moveY = 0;
    let moveZ = 0;

    // Match velocity
    let avgVX = 0;
    let avgVY = 0;
    let avgVZ = 0;
  
    // Match color
    let avgHue = 0;

    let numNeighbors = 0;

    const pos = boid.object.position;

    for (let otherBoid of boids) {
        if (distance(boid, otherBoid) < params.sightDist) {
            // Fly to Center
            centerX += otherBoid.object.position.x;
            centerY += otherBoid.object.position.y;
            centerZ += otherBoid.object.position.z;

            // Avoid others
            const otherPos = otherBoid.object.position;
            if (distance(boid, otherBoid) < params.minDistance) {
                moveX += pos.x - otherPos.x;
                moveY += pos.y - otherPos.y;
                moveZ += pos.z - otherPos.z;
            }

            // Match velocity
            avgVX += otherBoid.velocity.x;
            avgVY += otherBoid.velocity.y;
            avgVZ += otherBoid.velocity.z;
            
            // Match color
            let smallest = 1000;
            let wrapNum = 0;
            for (let i = -360; i < 361; i+=360) {
                let difference = Math.abs(i + otherBoid.hue - boid.hue);
                if (smallest > difference) {
                    smallest = difference;
                    wrapNum = i;
                }
            }
            avgHue += otherBoid.hue + wrapNum;
            
            numNeighbors += 1;
        }
    }
  
    if (numNeighbors) {
        // Fly to Center
        centerX = centerX / numNeighbors;
        centerY = centerY / numNeighbors;
        centerZ = centerZ / numNeighbors;
        
        boid.accellerate((centerX - pos.x) * params.centeringFactor, 0, 0);
        boid.accellerate(0, (centerY - pos.y) * params.centeringFactor, 0);
        boid.accellerate(0, 0, (centerZ - pos.z) * params.centeringFactor);

        // Match velocity
        avgVX = avgVX / numNeighbors;
        avgVY = avgVY / numNeighbors;
        avgVZ = avgVZ / numNeighbors;
    
        boid.accellerate(avgVX * params.matchingFactor, 0, 0);
        boid.accellerate(0, avgVY * params.matchingFactor, 0);
        boid.accellerate(0, 0, avgVZ * params.matchingFactor);

        // Match color
        let nearHueAvg = mod(avgHue / numNeighbors, 360);

        let smallest = 1000;
        let wrapNum = 0;
        for (let i = -360; i < 361; i+=360) {
            let difference = Math.abs(i + nearHueAvg - boid.hue);
            if (smallest > difference) {
                smallest = difference;
                wrapNum = i;
            }
        }

        boid.queuedHue = mod((nearHueAvg + wrapNum + boid.hue) / 2 + Math.min(Math.max(pos.x * 3 / params.radius, -3), 3), 360);
    }

    // Avoid others
    boid.accellerate(moveX * params.avoidFactor, 0, 0);
    boid.accellerate(0, moveY * params.avoidFactor, 0);
    boid.accellerate(0, 0, moveZ * params.avoidFactor);
}

function moveBoid(boid) {
    boid.applyAccelleration();
    boid.object.position.add(boid.velocity.multiplyScalar(params.speed));
}

class Boid {
    constructor() {
        this.hue = Math.random() * 360;
        this.queuedHue = 0;

        this.material = new THREE.MeshBasicMaterial( {color: hslToHex(this.hue, 100, 50)} );
        this.object = new THREE.Mesh( boidGeometry, this.material );
        this.object.position.random();
        this.object.position.multiplyScalar(params.radius * 2);
        this.object.position.add(new THREE.Vector3(-params.radius, -params.radius, -params.radius));

        this.velocity = new THREE.Vector3();
        this.velocity.randomDirection();

        this.frameAccelleration = new THREE.Vector3(); // The total accelleration applied this frame
    }

    accellerate(x, y, z) {
        this.frameAccelleration.x += x;
        this.frameAccelleration.y += y;
        this.frameAccelleration.z += z;
    }

    applyAccelleration() {
        this.frameAccelleration.normalize();
        this.frameAccelleration.multiplyScalar(params.maxAccelleration);
        this.velocity.add(this.frameAccelleration);
        this.velocity.normalize();
        this.frameAccelleration.multiplyScalar(0);

        // Rotate to face velocity
        this.object.lookAt(this.object.position.x + this.velocity.x, this.object.position.y + this.velocity.y, this.object.position.z + this.velocity.z);
    }

    updateColor() {
        this.hue = this.queuedHue;
        this.material.color.set(hslToHex(this.hue, 100, 50));
    }
}

function initGUI() {
    const gui = new dat.gui.GUI();
    const generalFolder = gui.addFolder('General');
    generalFolder.add(params, 'pauseSim').name("Pause Simulation");
    generalFolder.add(params, 'showBounds').name("Show Bounds");
    generalFolder.open();

    const worldFolder = gui.addFolder('World');
    worldFolder.add(params, 'radius', 1, 2000).name("Bounds Radius");
    worldFolder.add(params, 'numBoids', 0, 5000).name("Number of Boids");
    worldFolder.open();

    const boidBrainFolder = gui.addFolder('Boid Brain');
    boidBrainFolder.add(params, 'boundsFactor', 0, 1).name("Bounds Factor");
    boidBrainFolder.add(params, 'avoidFactor', 0, 1).name("Separation");
    boidBrainFolder.add(params, 'matchingFactor', 0, 1).name("Alignment");
    boidBrainFolder.add(params, 'centeringFactor', 0, 1).name("Cohesion");
    boidBrainFolder.add(params, 'minDistance', 0, 200).name("Separation Dist");
    boidBrainFolder.add(params, 'speed', 0, 30).name("Speed");
    boidBrainFolder.add(params, 'maxAccelleration', 0, 5).name("Accelleration");
    boidBrainFolder.add(params, 'sightDist', 0, 1000).name("Vision Radius");
    boidBrainFolder.open();

    const boidVisualsFolder = gui.addFolder('Boid Visuals');
    boidVisualsFolder.add(params, 'boidWidth', 0.2, 30).name("Boid Width");
    boidVisualsFolder.add(params, 'boidLength', 0.2, 30).name("Boid Height");
    boidVisualsFolder.add(params, 'afterimageEffect').name("Enable Afterimage");
    boidVisualsFolder.add(params, 'afterimageAmount', 0, 1).name("Afterimage Strength");
    boidVisualsFolder.open();
}

function init()
{
    initGUI();

    scene = new THREE.Scene( );
    let ratio = window.innerWidth/window.innerHeight;
    camera = new THREE.PerspectiveCamera(45,ratio,0.1,100000);

    camera.position.set(0,0,params.radius*4);
    camera.lookAt(0,0,1);

    renderer = new THREE.WebGLRenderer( { preserveDrawingBuffer: true } );

    renderer.setSize(window.innerWidth,window.innerHeight);
    document.body.appendChild(renderer.domElement );

    controls = new THREE.OrbitControls( camera, renderer.domElement );

    // Initiates the first wave of boids
    for (let i = 0; i < params.numBoids; i++) {
        let newBoid = new Boid();
        scene.add(newBoid.object);
        boids.push(newBoid);   
    }

    // Sets up the bounds visualiser
    const sphere = new THREE.SphereGeometry(1);
    helperSphere = new THREE.Mesh( sphere, new THREE.MeshBasicMaterial( 0xff0000 ) );
    helperBox = new THREE.BoxHelper( helperSphere, 0x888800 );
    scene.add( helperBox );

    // Afterimage effect
    fadeScene = new THREE.Scene( );
    fadeCam = new THREE.PerspectiveCamera(45,ratio,0.1,100000);

    // Afterimage fade plane (https://discourse.threejs.org/t/trails-background-image/17673)
    fadeMaterial = new THREE.MeshBasicMaterial ( {
        color : 0x000000,
        transparent : true,
        opacity : 0.5,			
        depthTest : false 
    });

    fadeMesh = new THREE.Mesh ( 
        new THREE.PlaneBufferGeometry ( 100 , 100 ) , 
        fadeMaterial 
    );

    fadeObject = fadeScene.add(fadeMesh);

    // Move afterimage plane
    let worldDir = new THREE.Vector3 ( ) ;
    fadeCam.getWorldDirection ( worldDir ) ;
    
    fadeMesh.position.addVectors ( fadeCam.position , worldDir) ;  	
    fadeMesh.rotation.copy ( fadeCam.rotation ) ;
}

init();

var UpdateLoop = function ( )
{
    // Adds and removes boids from the scene
    if(params.numBoids > boids.length) {
        for (let i = boids.length; i < params.numBoids; i++) {
            let newBoid = new Boid();
            scene.add(newBoid.object);
            boids.push(newBoid);  
        }
    } else if (params.numBoids < boids.length){
        for (let i = boids.length - 1; i > params.numBoids; i--) {
            scene.remove(boids[i].object);
            boids.pop();
        }
    }

    // Updates bounds box
    if (helperSphere.scale.x != params.radius) {
        helperSphere.scale.multiplyScalar(params.radius / helperSphere.scale.x);
        helperBox.update();
    }
    helperBox.visible = params.showBounds;

    // Calls the functions to run the boid simulation
    if (!params.pauseSim) {
        for (let i = 0; i < boids.length; i++) {
            const boid = boids[i];
            wallBounce(boid);
            combinedBrain(boid);
        }
    
        for (let i = 0; i < boids.length; i++) {
            const boid = boids[i];
            moveBoid(boid);
            boid.updateColor();
        }
    }

    // Updates boid size
    if(params.boidWidth !== prevWidth) {
        boidGeometry.scale(params.boidWidth/prevWidth, params.boidWidth/prevWidth, 1);
        prevWidth = params.boidWidth;
    }
    if(params.boidLength !== prevLength) {
        boidGeometry.scale(1, 1, params.boidLength/prevLength);
        prevLength = params.boidLength;
    }

    // Toggle after image effect
    if (params.afterimageEffect !== prevAfterimageEffect) {
        renderer.autoClearColor = !params.afterimageEffect;
        prevAfterimageEffect = params.afterimageEffect;
    }
    if (!params.afterimageEffect) {
        renderer.clearColor();
    } else {
        renderer.render(fadeScene,fadeCam);
    }

    // Update afterimage material
    if (prevAfterimageAmount !== params.afterimageAmount) {
        fadeMaterial.opacity = (1 - params.afterimageAmount) / 2;
        prevAfterimageAmount = params.afterimageAmount;
    }

    renderer.render(scene,camera);

    // Update orbit controls
    controls.update();

    requestAnimationFrame(UpdateLoop);
};

requestAnimationFrame(UpdateLoop);

var OnResize = function ( ) {
    var width = window.innerWidth;
    var height = window.innerHeight;
    renderer.setSize(width,height);
    camera.aspect = width/height;
    camera.updateProjectionMatrix();
    renderer.render(scene,camera);
};

window.addEventListener('resize', OnResize);