import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

export default class DiceController {
    constructor() {
        this.isRolling = false;
        this.onRollComplete = null;
        
        // Settings
        this.diceCount = 2;
        this.container = null;
        this.diceMeshes = [];
        this.diceBodies = [];
        
        // State
        this.animationFrameId = null;
        this.stableFrames = 0;
    }

    async init() {
        console.log('DiceController initializing...');
        
        this.container = document.getElementById('dice-container');
        if (!this.container) {
            console.error("Dice container not found!");
            return;
        }

        // 1. Setup Three.js
        this.scene = new THREE.Scene();
        
        const aspect = this.container.clientWidth / this.container.clientHeight;
        const frustumSize = 25;
        this.camera = new THREE.OrthographicCamera(
            frustumSize * aspect / -2, frustumSize * aspect / 2,
            frustumSize / 2, frustumSize / -2,
            0.1, 100
        );
        this.camera.position.set(0, 20, 0); // Top-down view
        this.camera.lookAt(0, 0, 0);

        this.renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
        this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.renderer.shadowMap.enabled = true;
        this.container.appendChild(this.renderer.domElement);

        // Lights
        const ambientLight = new THREE.AmbientLight(0xffffff, 1.0);
        this.scene.add(ambientLight);
        
        const dirLight = new THREE.DirectionalLight(0xffffff, 2.0);
        dirLight.position.set(5, 10, 5);
        dirLight.castShadow = true;
        dirLight.shadow.mapSize.width = 1024;
        dirLight.shadow.mapSize.height = 1024;
        this.scene.add(dirLight);

        // 2. Setup Cannon-es Physics
        this.world = new CANNON.World({
            gravity: new CANNON.Vec3(0, -50, 0),
        });

        // Materials
        const floorMat = new CANNON.Material();
        const diceMat = new CANNON.Material();
        const diceFloorContact = new CANNON.ContactMaterial(floorMat, diceMat, {
            friction: 0.3, 
            restitution: 0.5 
        });
        this.world.addContactMaterial(diceFloorContact);

        // Floor Body (Invisible)
        const floorShape = new CANNON.Plane();
        const floorBody = new CANNON.Body({ mass: 0, material: floorMat });
        floorBody.addShape(floorShape);
        floorBody.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
        this.world.addBody(floorBody);
        
        // Paredes invisibles
        const wallShape = new CANNON.Box(new CANNON.Vec3(20, 20, 1));
        const walls = [
            { pos: [0, 0, 10], rot: [0, 0, 0] },     
            { pos: [0, 0, -10], rot: [0, 0, 0] },    
            { pos: [10, 0, 0], rot: [0, Math.PI/2, 0] },  
            { pos: [-10, 0, 0], rot: [0, Math.PI/2, 0] }  
        ];
        walls.forEach(w => {
            const wallBody = new CANNON.Body({ mass: 0, material: floorMat });
            wallBody.addShape(wallShape);
            wallBody.position.set(...w.pos);
            wallBody.quaternion.setFromEuler(...w.rot);
            this.world.addBody(wallBody);
        });

        // 3. Load Custom Asset
        await this.loadDiceModel(diceMat);

        // 4. Handle UI
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

        // Handle popup close
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

        // Resize handler
        window.addEventListener('resize', this.onResize.bind(this));

        // Start Loop
        this.clock = new THREE.Clock();
        this.animate();
        console.log('DiceController initialized & calibrated successfully.');
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
        
        const dt = this.clock.getDelta();
        this.world.step(1/60, Math.min(dt, 0.1), 3); 

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

        if (this.renderer && this.scene && this.camera) {
            this.renderer.render(this.scene, this.camera);
        }
    }

    calculateResult() {
        this.isRolling = false;
        const results = [];
        let total = 0;

        // VECTORES CALIBRADOS FINALMENTE
        const faceNormals = [
            { vector: new THREE.Vector3(0, 1, 0), value: 4 },  // Y Positivo
            { vector: new THREE.Vector3(0, -1, 0), value: 3 }, // Y Negativo
            { vector: new THREE.Vector3(1, 0, 0), value: 2 },  // X Positivo
            { vector: new THREE.Vector3(-1, 0, 0), value: 1 }, // X Negativo
            { vector: new THREE.Vector3(0, 0, 1), value: 6 },  // Z Positivo
            { vector: new THREE.Vector3(0, 0, -1), value: 5 }  // Z Negativo
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
        if (!this.container || !this.camera || !this.renderer) return;
        const width = this.container.clientWidth;
        const height = this.container.clientHeight;
        const aspect = width / height;
        const frustumSize = 25;
        this.camera.left = frustumSize * aspect / -2;
        this.camera.right = frustumSize * aspect / 2;
        this.camera.top = frustumSize / 2;
        this.camera.bottom = frustumSize / -2;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(width, height);
    }
}