import * as THREE from 'three';

const checkDirections = [];

class Player {
    constructor(scene, collidible) {
        this.clock = new THREE.Clock();
        this.camera = new THREE.PerspectiveCamera( 100, window.innerWidth / window.innerHeight, 0.1, 1000 );
        this.camera.rotation.order = 'YXZ';
        
        this.scene = scene;
        this.collidible = collidible;

        this.inputVector = new THREE.Vector3();

        this.checkCollisions = false;

        this.GRAVITY = 30;
        
        this.STEPS_PER_FRAME = 5;
        
        this.chunkOctrees = [];
        
        this.playerVelocity = new THREE.Vector3();
        this.playerDirection = new THREE.Vector3();
        
        this.playerSpeed = 0;
        this.framesTillHitsound = 0;
        this.wallHitSoundQueued = 0;
        this.shortestCast = 100;
        this.wallSlideVolume = 0;

        this.playerOnFloor = false;

        this.keyStates = {};
    
        this.raycaster = new THREE.Raycaster();
        this.raycaster.far = 3;

        document.addEventListener( 'keydown', ( event ) => {
    
            this.keyStates[ event.code ] = true;
        
        } );
        
        document.addEventListener( 'keyup', ( event ) => {
        
            this.keyStates[ event.code ] = false;
        
        } );
        
        document.body.addEventListener( 'mousemove', ( event ) => {
        
            if ( document.pointerLockElement === document.body ) {
        
                this.camera.rotation.y -= event.movementX / 500;
                this.camera.rotation.x = Math.min(Math.PI/2 - 0.05, Math.max(-Math.PI/2 + 0.05, this.camera.rotation.x - event.movementY / 500));
        
            }
        
        } );

        for (let z = -1; z < 2; z++) {
            for (let y = -1; y < 2; y++) {
                for (let x = -1; x < 2; x++) {
                    if (x === 0 && y === 0 && z === 0) continue;
                    const vec = new THREE.Vector3(x, y, z);
                    vec.normalize();
                    checkDirections.push(vec);
                }
            }
        }
    }
    
    playerCollisions() {
        //this.raycaster.setFromCamera(new Vector2(0, 0), this.camera);
        
        checkDirections.forEach(dir => {
            this.raycaster.set(this.camera.position, dir);
            const intersects = this.raycaster.intersectObjects(this.collidible.children);
            intersects.forEach(intersect => {
                this.playerVelocity.addScaledVector(dir, -(0.1/intersect.distance));
                this.shortestCast = Math.min(intersect.distance, this.shortestCast);
            });
        });
    }
    
    
    updatePlayer(deltaTime) {
        let damping = Math.exp( - 4 * deltaTime ) - 1;
    
        if (!this.playerOnFloor) {
            //this.playerVelocity.y -= this.GRAVITY * deltaTime;
    
            // small air resistance
            
        }
    
        damping *= 0.99;

        this.playerVelocity.addScaledVector( this.playerVelocity, damping );
        
        this.playerVelocity.clampLength(0, 35);

        const deltaPosition = this.playerVelocity.clone().multiplyScalar( deltaTime );
        this.camera.position.add( deltaPosition );
    
        if (this.checkCollisions)
            this.playerCollisions();
    
        // this.camera.position.copy( this.playerCollider.end );
    
    }
    
    getForwardVector() {
    
        this.camera.getWorldDirection( this.playerDirection );
        //this.playerDirection.y = 0;
        //this.playerDirection.normalize();
    
        return this.playerDirection;
    
    }
    
    getSideVector() {
    
        this.camera.getWorldDirection( this.playerDirection );
        this.playerDirection.y = 0;
        this.playerDirection.normalize();
        this.playerDirection.cross( this.camera.up );
    
        return this.playerDirection;
    
    }
    
    controls(deltaTime) {
        // gives a bit of air control
        const speedDelta = deltaTime * ( 50 );
    
        this.inputVector.set(0, 0, 0);

        if ( this.keyStates['KeyW'] ) {
            this.inputVector.add( this.getForwardVector() );
    
        }
    
        if ( this.keyStates['KeyS'] ) {
            this.inputVector.add( this.getForwardVector().multiplyScalar( - 1 ) );
    
        }
    
        if ( this.keyStates['KeyA'] ) {
            this.inputVector.add( this.getSideVector().multiplyScalar( - 1 ) );
    
        }
    
        if ( this.keyStates['KeyD'] ) {
            this.inputVector.add( this.getSideVector() );
    
        }
    
        if ( this.keyStates['Space'] ) {
            this.inputVector.add( new THREE.Vector3(0, 1, 0) );
        }

        if ( this.keyStates['ControlLeft'] ) {
            this.inputVector.add( new THREE.Vector3(0, -1, 0) );
        }

        this.inputVector.normalize();

        if ( this.keyStates['ShiftLeft'] ) {
            this.inputVector.multiplyScalar( 2 );
        }

        this.playerVelocity.add(this.inputVector.multiplyScalar( speedDelta ));
    }

    updatePhysics() {

        const deltaTime = Math.min( 0.05, this.clock.getDelta() ) / this.STEPS_PER_FRAME;
    
        // we look for collisions in substeps to mitigate the risk of
        // an object traversing another too quickly for detection.
    
        for ( let i = 0; i < this.STEPS_PER_FRAME; i ++ ) {
            this.controls(deltaTime);
            this.updatePlayer(deltaTime);
        }

        // Code for wall hit sound detection
        if (this.framesTillHitsound > 0) this.framesTillHitsound--;

        let playerSpeed = this.playerVelocity.length();

        if (this.framesTillHitsound == 0 && this.playerSpeed - playerSpeed > 1 && this.shortestCast < 0.8) {
            this.wallHitSoundQueued = Math.min(1.5, (this.playerSpeed - playerSpeed - 0.8) / 8);
            this.framesTillHitsound = 50;
        }
        this.playerSpeed = playerSpeed;
        this.wallSlideVolume = this.shortestCast != 100 ? Math.min(1, playerSpeed * (1 - this.shortestCast / 3) * 0.01) : 0;
        this.shortestCast = 100;
    }
}

export { Player };

