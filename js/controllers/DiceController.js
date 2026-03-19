import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

export default class DiceController {
    constructor() {
        this.isRolling = false;
        this.onRollComplete = null;
        
        this.diceCount = 2;
        this.container = null;
        this.diceMeshes = [];
        this.diceBodies = [];
        
        this.animationFrameId = null;
        this.stableFrames = 0;
    }

    setupGlobalContext(scene, world, floorPhysicsMaterial) {
        this.scene = scene;
        this.world = world;
        this.floorPhysicsMaterial = floorPhysicsMaterial;
    }

    async init() {
        
        const diceMat = new CANNON.Material();
        const diceFloorContact = new CANNON.ContactMaterial(this.floorPhysicsMaterial, diceMat, {
            friction: 0.3, 
            restitution: 0.5 
        });
        this.world.addContactMaterial(diceFloorContact);

        await this.loadDiceModel(diceMat);

        const rollBtn = document.getElementById('roll-button');
        if (rollBtn) {
            rollBtn.addEventListener('click', () => {
                if (!this.isRolling) {
                    const popupOverlay = document.getElementById('dice-popup');
                    if(popupOverlay) popupOverlay.classList.remove('show');
                    this.roll();
                }
            });
        }

        const closeBtn = document.getElementById('close-popup-btn');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                const popupOverlay = document.getElementById('dice-popup');
                if(popupOverlay) popupOverlay.classList.remove('show');

                if (this.onRollComplete && this.lastRollTotal) {
                    this.onRollComplete(this.lastRollResults, this.lastRollTotal);
                    this.lastRollTotal = null;
                }
            });
        }

        window.addEventListener('resize', this.onResize.bind(this));

        this.clock = new THREE.Clock();
        this.animate();
    }

    async loadDiceModel(physicsMaterial) {
        const loader = new GLTFLoader();
        return new Promise((resolve) => {
            loader.load('./assets/dado/dice.glb', (gltf) => {
                const originalMesh = gltf.scene;
                
                for(let i = 0; i < this.diceCount; i++) {
                    const clone = originalMesh.clone();
                    clone.scale.set(14, 14, 14); 
                    clone.traverse(c => { if(c.isMesh) { c.castShadow = true; c.receiveShadow = true; }});
                    
                    this.scene.add(clone);
                    clone.position.set(0, -100, 0); 
                    this.diceMeshes.push(clone);

                    const box = new THREE.Box3().setFromObject(clone);
                    const size = box.getSize(new THREE.Vector3());
                    
                    const shape = new CANNON.Box(new CANNON.Vec3(size.x/2, size.y/2, size.z/2));
                    const body = new CANNON.Body({
                        mass: 0, 
                        material: physicsMaterial
                    });
                    
                    body.type = CANNON.Body.STATIC; 
                    body.addShape(shape);
                    body.position.set(2 * i, -100, 0); 
                    
                    this.world.addBody(body);
                    this.diceBodies.push(body);
                }
                resolve();
            });
        });
    }

    roll() {
        this.isRolling = true;
        this.stableFrames = 0;

        const popupResultEl = document.getElementById('dice-result-popup');
        if (popupResultEl) popupResultEl.textContent = '...';

        this.diceBodies.forEach((body, index) => {
            body.type = CANNON.Body.DYNAMIC;
            body.mass = 1;
            body.updateMassProperties(); 
            body.wakeUp();

            body.position.set(-2 + (index * 4), 15, 6);

            body.quaternion.setFromEuler(
                Math.random() * Math.PI * 2,
                Math.random() * Math.PI * 2,
                Math.random() * Math.PI * 2
            );

            body.velocity.set(
                (Math.random() * 8) - 4, 
                -15,                     
                -10 - (Math.random() * 10) 
            );

            body.angularVelocity.set(
                Math.random() * 30 - 15,
                Math.random() * 30 - 15,
                Math.random() * 30 - 15
            );
        });
    }

    animate() {
        this.animationFrameId = requestAnimationFrame(this.animate.bind(this));
        
        let allStopped = true;

        for(let i = 0; i < this.diceCount; i++) {
            const body = this.diceBodies[i];
            const mesh = this.diceMeshes[i];
            
            if (body && mesh) {
                mesh.position.copy(body.position);
                mesh.quaternion.copy(body.quaternion);

                if (this.isRolling && body.type === CANNON.Body.DYNAMIC) {
                    const speed = body.velocity.lengthSquared() + body.angularVelocity.lengthSquared();
                    if (speed > 0.1) {
                        allStopped = false;
                    }
                }
            }
        }

        if (this.isRolling) {
            if (allStopped) {
                this.stableFrames++;
                if (this.stableFrames > 20) { 
                    this.calculateResult();
                }
            } else {
                this.stableFrames = 0; 
            }
        }

        
    }

    calculateResult() {
        this.isRolling = false;
        const results = [];
        let total = 0;

        const faceNormals = [
            { vector: new THREE.Vector3(0, 1, 0), value: 4 },  
            { vector: new THREE.Vector3(0, -1, 0), value: 3 }, 
            { vector: new THREE.Vector3(1, 0, 0), value: 2 },  
            { vector: new THREE.Vector3(-1, 0, 0), value: 1 }, 
            { vector: new THREE.Vector3(0, 0, 1), value: 6 },  
            { vector: new THREE.Vector3(0, 0, -1), value: 5 }  
        ];

        this.diceMeshes.forEach(mesh => {
            let maxDot = -Infinity;
            let finalValue = -1;

            faceNormals.forEach(face => {
                const rotatedNormal = face.vector.clone().applyQuaternion(mesh.quaternion);
                const dot = rotatedNormal.dot(new THREE.Vector3(0, 1, 0)); 
                
                if (dot > maxDot) {
                    maxDot = dot;
                    finalValue = face.value;
                }
            });

            results.push({ value: finalValue });
            total += finalValue;
        });

        const popupResultEl = document.getElementById('dice-result-popup');
        if (popupResultEl) popupResultEl.textContent = total;

        const popupOverlay = document.getElementById('dice-popup');
        if (popupOverlay) popupOverlay.classList.add('show');

        this.lastRollResults = results;
        this.lastRollTotal = total;
    }

    onResize() {
    }
}