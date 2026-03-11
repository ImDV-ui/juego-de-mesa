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
        console.log('DiceController (Custom) initializing...');
        
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
            gravity: new CANNON.Vec3(0, -40, 0), // Strong gravity to fall fast
        });

        // Materials
        const floorMat = new CANNON.Material();
        const diceMat = new CANNON.Material();
        const diceFloorContact = new CANNON.ContactMaterial(floorMat, diceMat, {
            friction: 0.1,
            restitution: 0.4
        });
        this.world.addContactMaterial(diceFloorContact);

        // Floor Body (Invisible plane in Three.js, but solid in Cannon)
        const floorShape = new CANNON.Plane();
        const floorBody = new CANNON.Body({ mass: 0, material: floorMat });
        floorBody.addShape(floorShape);
        floorBody.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
        this.world.addBody(floorBody);
        
        // Invisible physics walls so dice don't roll off screen
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
        const rollBtn = document.querySelector('.btn-roll') || document.getElementById('roll-button');
        if (rollBtn) {
            rollBtn.addEventListener('click', () => this.roll());
        }

        // Resize handler
        window.addEventListener('resize', this.onResize.bind(this));

        // Start Loop
        this.clock = new THREE.Clock();
        this.animate();
        console.log('DiceController initialized successfully.');
    }

    async loadDiceModel(physicsMaterial) {
        const loader = new GLTFLoader();
        return new Promise((resolve) => {
            loader.load('./assets/dado/dice.glb', (gltf) => {
                const originalMesh = gltf.scene;
                
                // Let's create `this.diceCount` instances
                for(let i = 0; i < this.diceCount; i++) {
                    const clone = originalMesh.clone();
                    clone.scale.set(1.5, 1.5, 1.5); // Adjust scale as needed
                    clone.traverse(c => { if(c.isMesh) { c.castShadow = true; c.receiveShadow = true; }});
                    
                    // Add to Three.js
                    this.scene.add(clone);
                    clone.position.set(0, -100, 0); // Hide initially
                    this.diceMeshes.push(clone);

                    // Add to Cannon.js
                    // A standard d6 is usually a box. 
                    // To get exact size, compute bounding box of the clone
                    const box = new THREE.Box3().setFromObject(clone);
                    const size = box.getSize(new THREE.Vector3());
                    
                    // Cannon Box takes half-extents
                    const shape = new CANNON.Box(new CANNON.Vec3(size.x/2, size.y/2, size.z/2));
                    const body = new CANNON.Body({
                        mass: 0.1, // Set mass > 0 so it responds to physics, wait, if we want to hide it, put it to sleep? 
                        material: physicsMaterial
                    });
                    // Start sleep
                    body.type = CANNON.Body.STATIC; // Will change to DYNAMIC on roll
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
        if (this.isRolling) return;
        this.isRolling = true;
        this.stableFrames = 0;

        const resultEl = document.getElementById('dice-result');
        if (resultEl) resultEl.textContent = '...';

        // Apply throw physics
        this.diceBodies.forEach((body, index) => {
             // Make dynamic so it moves
            body.type = CANNON.Body.DYNAMIC;
            body.wakeUp();
            body.mass = 1;

            // Start position (high up, slightly off center to avoid collision initially)
            body.position.set(-3 + (index * 6), 15 + (index * 2), 5);

            // Random rotation
            body.quaternion.setFromEuler(
                Math.random() * Math.PI * 2,
                Math.random() * Math.PI * 2,
                Math.random() * Math.PI * 2
            );

            // Throw velocity towards center varying
            body.velocity.set(
                (Math.random() * 5),
                -10 - (Math.random() * 10),
                -15 - (Math.random() * 10)
            );

            // Angular velocity (Spin)
            body.angularVelocity.set(
                Math.random() * 20 - 10,
                Math.random() * 20 - 10,
                Math.random() * 20 - 10
            );
        });
    }

    animate() {
        this.animationFrameId = requestAnimationFrame(this.animate.bind(this));
        
        const dt = this.clock.getDelta();
        this.world.step(1/60, dt, 3); // Update physics

        let allStopped = true;

        // Sync meshes and check if stopped
        for(let i = 0; i < this.diceCount; i++) {
            const body = this.diceBodies[i];
            const mesh = this.diceMeshes[i];
            
            if (body && mesh) {
                mesh.position.copy(body.position);
                mesh.quaternion.copy(body.quaternion);

                // Check movement threshold
                if (this.isRolling && body.type === CANNON.Body.DYNAMIC) {
                    const speed = body.velocity.lengthSquared() + body.angularVelocity.lengthSquared();
                    if (speed > 0.05) {
                        allStopped = false;
                    }
                }
            }
        }

        if (this.isRolling && allStopped) {
            this.stableFrames++;
            if (this.stableFrames > 15) { // Wait a bit to ensure they truly settled
                this.calculateResult();
            }
        }

        // Render scene
        if (this.renderer && this.scene && this.camera) {
            this.renderer.render(this.scene, this.camera);
        }
    }

    calculateResult() {
        this.isRolling = false;
        const results = [];
        let total = 0;

        // Normal vectors for each face of the dice model. 
        // NOTE: These vectors depend entirely on how the `dice.glb` asset is modeled!
        // Usually, default faces are along axes: +y=1, -y=6, +x=2, -x=5, +z=3, -z=4 (or similar)
        // We will assume a standard axis mapping, but if it's wrong, we can iterate:
        const faceNormals = [
            { vector: new THREE.Vector3(0, 1, 0), value: 1 }, 
            { vector: new THREE.Vector3(0, -1, 0), value: 6 },
            { vector: new THREE.Vector3(1, 0, 0), value: 5 }, // Assume +x is 5
            { vector: new THREE.Vector3(-1, 0, 0), value: 2 }, // Assume -x is 2
            { vector: new THREE.Vector3(0, 0, 1), value: 3 }, // Assume +z is 3
            { vector: new THREE.Vector3(0, 0, -1), value: 4 }  // Assume -z is 4
        ];

        this.diceMeshes.forEach(mesh => {
            let maxDot = -Infinity;
            let finalValue = -1;

            faceNormals.forEach(face => {
                // Apply the mesh's current rotation to the local face normal
                const rotatedNormal = face.vector.clone().applyQuaternion(mesh.quaternion);
                
                // Dot product with world "UP" (0, 1, 0)
                const dot = rotatedNormal.dot(new THREE.Vector3(0, 1, 0));
                
                if (dot > maxDot) {
                    maxDot = dot;
                    finalValue = face.value;
                }
            });

            results.push({ value: finalValue });
            total += finalValue;
        });

        console.log('Dice roll complete:', results);
        const resultEl = document.getElementById('dice-result');
        if (resultEl) resultEl.textContent = total;

        if (this.onRollComplete) {
            this.onRollComplete(results, total);
        }
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
