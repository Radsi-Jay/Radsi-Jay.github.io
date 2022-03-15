let scene, camera, renderer;
let controls;

// Adjustable parameters
let params = {
    pauseSim: false,
    showBounds: true,
    radius: 500,
    boundsFactor: 1,
    matchingFactor: 0.05,
    centeringFactor: 0.005,
    avoidFactor: 0.05,
    minDistance: 20,
    sightDist: 80,
    speed: 5,
    maxAccelleration: 0.5,
    numBoids: 1000,
    boidLength: 5,
    boidWidth: 2
}

let prevLength = 1;
let prevWidth = 1;

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

        boid.queuedHue = mod((nearHueAvg + wrapNum + boid.hue) / 2 + pos.x * 3 / params.radius, 360);
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
    generalFolder.add(params, 'pauseSim');
    generalFolder.add(params, 'showBounds');
    generalFolder.open();

    const worldFolder = gui.addFolder('World');
    worldFolder.add(params, 'radius', 0, 2000);
    worldFolder.add(params, 'numBoids', 0, 5000);
    worldFolder.open();

    const boidBrainFolder = gui.addFolder('Boid Brain');
    boidBrainFolder.add(params, 'boundsFactor', 0, 1);
    boidBrainFolder.add(params, 'matchingFactor', 0, 1);
    boidBrainFolder.add(params, 'centeringFactor', 0, 1);
    boidBrainFolder.add(params, 'avoidFactor', 0, 1);
    boidBrainFolder.add(params, 'minDistance', 0, 200);
    boidBrainFolder.add(params, 'speed', 0, 30);
    boidBrainFolder.add(params, 'maxAccelleration', 0, 5);
    boidBrainFolder.add(params, 'sightDist', 0, 1000);
    boidBrainFolder.open();

    const boidVisualsFolder = gui.addFolder('Boid Visuals');
    boidVisualsFolder.add(params, 'boidWidth', 0.2, 30);
    boidVisualsFolder.add(params, 'boidLength', 0.2, 30);
    boidVisualsFolder.open();
}

function init()
{
    initGUI();

    scene = new THREE.Scene( );
    let ratio = window.innerWidth/window.innerHeight;
    camera = new THREE.PerspectiveCamera(45,ratio,0.1,10000);

    camera.position.set(0,0,params.radius*4);
    camera.lookAt(0,0,1);

    renderer = new THREE.WebGLRenderer( );

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

    renderer.render(scene,camera);

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