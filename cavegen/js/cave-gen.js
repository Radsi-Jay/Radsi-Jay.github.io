import * as THREE from 'three';
import SimplexNoise from './simplex-noise.js';

import { MarchingCubes } from './MarchingCubes.js';

const simplex = new SimplexNoise();

let xOffset = 0;

class CaveGen {
    constructor(scene, collidible, scale, noiseScale, resolution, material, ore, mainOreGroup) {
        this.scene = scene;
        this.collidible = collidible;
        this.segments = [];
        this.material = material;
        

        this.scale = scale;
        this.noiseScale = noiseScale;
        this.resolution = resolution;

        this.ore = ore;
        this.mainOreGroup = mainOreGroup;
    }

    generateAround = async function(x, y, z) {
        this.segments.forEach(seg => {
            seg.old = true;
        });

        const genSize = 5;

        for (let zO = -genSize; zO < genSize + 1; zO++) {
            for (let yO = -genSize; yO < genSize + 1; yO++) {
                for (let xO = -genSize; xO < genSize + 1; xO++) {
                    let existingIndex = this.segments.findIndex((seg) => seg.x == x + xO && seg.y == y + yO && seg.z == z + zO);
                    if (existingIndex == -1) {
                        if (Math.abs(xO) < genSize - 1 && Math.abs(yO) < genSize - 1 && Math.abs(zO) < genSize - 1) {
                            this.segments.push(this.generateSegment(x + xO, y + yO, z + zO));
                        }
                    } else {
                        this.segments[existingIndex].old = false;
                    }
                }
            }
        }

        this.segments.forEach(seg => {
            if (seg.old == true) {
                this.collidible.remove( seg.mc );
                this.mainOreGroup.remove( seg.oreGroup );
            }
        });

        this.segments = this.segments.filter((seg) => seg.old == false);

        const segmentPromises = [];

        this.segments.forEach(segment => {
            if (!segment.geometryGenerated) {
                segmentPromises.push(segment.generateRandom());
                
            }
        });
        await Promise.all(segmentPromises);
    }

    generateSegment(x, y, z) {
        let caveSeg = new CaveSegment(x, y, z, this.resolution, this.noiseScale, this.scale, this.material, this.mainOreGroup, this.ore);
        this.collidible.add( caveSeg.mc );
        return caveSeg;
    }
}

class CaveSegment {
    constructor(x, y, z, resolution, noiseScale, scale, material, mainOreGroup, ore) {
        this.old = false;

        this.x = x;
        this.y = y;
        this.z = z;

        this.resolution = resolution;
        this.noiseScale = noiseScale;
        this.scale = scale;

        this.ore = ore;
        this.mainOreGroup = mainOreGroup;        
                

        this.oreGroup = new THREE.Group();
        
        this.tempOffset = 1;

        this.mc = new MarchingCubes( resolution, material, false, false, 200 );
        this.mc.frustumCulled = false;
        this.mc.position.set( x * (1 - 3/resolution) * this.scale * 2 * this.tempOffset, y * (1 - 3/resolution) * this.scale * 2 * this.tempOffset, z * (1 - 3/resolution) * this.scale * 2 * this.tempOffset);
        this.mc.scale.set( this.scale, this.scale, this.scale );

        this.geometryGenerated = false;
    }

    generateOre = function() {
        const posArray = this.mc.geometry.getAttribute("position").array;
        const normArray = this.mc.geometry.getAttribute("normal").array;
        for (let i = 0; i < posArray.length; i+=3){
            
            const sx = posArray[i + 0] * this.scale;
            const sy = posArray[i + 1] * this.scale;
            const sz = posArray[i + 2] * this.scale;

            const translation = new THREE.Matrix4();
            translation.makeTranslation(sx, sy, sz);

            if(this.getNoiseAtPos(i, (i + 2), (i + 3)) > 1200 && !(sx == 0 && sy == 0 && sz == 0)){
                var newOre = this.ore.clone();

                let hue = Math.random();

                newOre.traverse( function( child ) {
                    if ( child instanceof THREE.Mesh ) {
                        if (child.name !== 'Icosphere') {
                            child.material = child.material.clone();
                            child.material.color.setHSL(hue, 1, 0.5);
                            child.material.emissive.setHSL(hue, 1, 0.5);
                        }
                    }
                });

                const nx = normArray[i + 0] * this.scale;
                const ny = normArray[i + 1] * this.scale;
                const nz = normArray[i + 2] * this.scale;

                newOre.applyMatrix4(translation);
                newOre.position.add(this.mc.position);
                newOre.lookAt(new THREE.Vector3(nx, ny, nz).add(newOre.position));
                newOre.rotateX(90);
                this.oreGroup.add(newOre);
            }
        }
        this.mainOreGroup.add(this.oreGroup);
    }

    generateRandom = async function () {
        this.mc.reset();

        let totalIter = 0;

        for (let x = 0; x < this.mc.size; x++) {
            for (let y = 0; y < this.mc.size; y++) {
                for (let z = 0; z < this.mc.size; z++) {
                    this.mc.setCell(x, y, z, this.getNoiseAtPos(x, y, z));
                    totalIter++;
                    if (totalIter % 5000 === 0) {
                        // wait for the next tick
                        await new Promise(res => setTimeout(res, 0));
                    }
                }
            }
        }

        

        await this.mc.onBeforeRenderButNot();
        this.generateOre();
        this.geometryGenerated = true;
    }

    getNoiseAtPos(x, y, z) {
        let xPos = x/this.resolution + this.x * (1 - 3/this.resolution);
        let yPos = y/this.resolution + this.y * (1 - 3/this.resolution);
        let zPos = z/this.resolution + this.z * (1 - 3/this.resolution);
        return (1 -
            (this.sampleNoise(xPos * this.noiseScale, yPos * this.noiseScale, zPos * this.noiseScale)) * 5
            + this.sampleNoise(xPos * this.noiseScale * 3, yPos * this.noiseScale * 3, zPos * this.noiseScale * 3)) * 200;
    }

    sampleNoise(x, y, z) {
        return simplex.noise3D(x + xOffset, y, z);
    }
}

export { CaveGen, CaveSegment };
