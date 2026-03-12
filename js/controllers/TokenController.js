import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

export default class TokenController {
    constructor() {
        this.tokens = [];
        this.spaces = new Array(40);
        this.boardEl = null;
    }

    init() {
        console.log('TokenController initializing...');
        this.boardEl = document.querySelector('.monopoly-board');
        this.mapSpaces();
        window.addEventListener('resize', this.onResize.bind(this));
    }

    mapSpaces() {
        const spaceEls = document.querySelectorAll('.space');
        spaceEls.forEach(space => {
            const colStyle = space.style.gridColumn.split('/')[0].trim();
            const rowStyle = space.style.gridRow.split('/')[0].trim();
            if (!colStyle || !rowStyle) return;

            const col = parseInt(colStyle);
            const row = parseInt(rowStyle);
            let index = -1;

            if (row === 11 && col === 11) index = 0;
            else if (row === 11 && col < 11 && col > 1) index = 11 - col;
            else if (col === 1 && row === 11) index = 10;
            else if (col === 1 && row < 11 && row > 1) index = 10 + (11 - row);
            else if (col === 1 && row === 1) index = 20;
            else if (row === 1 && col > 1 && col < 11) index = 20 + (col - 1);
            else if (col === 11 && row === 1) index = 30;
            else if (col === 11 && row > 1 && row < 11) index = 30 + (row - 1);

            if (index !== -1) {
                this.spaces[index] = space;
            }
        });
        console.log('Board spaces mapped:', this.spaces);
    }

    async createPlayerToken(playerId, modelPath) {
        // Create the container DIV
        const tokenDiv = document.createElement('div');
        tokenDiv.className = 'token';
        tokenDiv.id = `token-${playerId}`;
        this.boardEl.appendChild(tokenDiv);

        // Create Three.js Scene for the token
        const width = 80;
        const height = 80;
        
        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 100);
        camera.position.set(0, 15, 20); // Elevated, looking down-ish
        camera.lookAt(0, 0, 0);

        const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
        renderer.setSize(width, height);
        renderer.setPixelRatio(window.devicePixelRatio);
        tokenDiv.appendChild(renderer.domElement);

        // Add lighting
        const ambientLight = new THREE.AmbientLight(0xffffff, 1.2);
        scene.add(ambientLight);
        const dirLight = new THREE.DirectionalLight(0xffffff, 1.5);
        dirLight.position.set(10, 20, 10);
        scene.add(dirLight);

        // Load model
        const loader = new GLTFLoader();
        let modelObj = null;
        
        await new Promise((resolve, reject) => {
            loader.load(
                modelPath,
                (gltf) => {
                    const model = gltf.scene;
                    
                    // Center and scale model
                    const box = new THREE.Box3().setFromObject(model);
                    const center = box.getCenter(new THREE.Vector3());
                    const size = box.getSize(new THREE.Vector3());
                    const maxDim = Math.max(size.x, size.y, size.z);
                    const scale = 12 / maxDim; // Fit within units
                    model.scale.set(scale, scale, scale);
                    model.position.sub(center.multiplyScalar(scale)); // Center it
                    
                    scene.add(model);
                    modelObj = model;
                    resolve();
                },
                undefined,
                (err) => reject(err)
            );
        });

        const token = {
            id: playerId,
            div: tokenDiv,
            scene,
            camera,
            renderer,
            model: modelObj,
            currentPosition: 0,
            targetPosition: 0
        };

        this.tokens.push(token);

        // Place on Start
        this.updateTokenDOMPosition(token);

        // Start render loop for this token
        const animate = () => {
            requestAnimationFrame(animate);
            /* Removed spinning effect to keep the car static
            if (token.model) {
                token.model.rotation.y += 0.02; 
            }
            */
            renderer.render(scene, camera);
        };
        animate();
        
        return token;
    }

    updateTokenDOMPosition(token) {
        const spaceEl = this.spaces[token.currentPosition];
        if (!spaceEl) return;
        
        // Calculate center of the space relative to the board
        const boardRect = this.boardEl.getBoundingClientRect();
        const spaceRect = spaceEl.getBoundingClientRect();

        const x = (spaceRect.left - boardRect.left) + (spaceRect.width / 2);
        const y = (spaceRect.top - boardRect.top) + (spaceRect.height / 2);

        token.div.style.left = `${x}px`;
        token.div.style.top = `${y}px`;

        // Update 3D Model Rotation based on board side
        if (token.model) {
            // Pos 0-10: Bottom row, moving left. 
            if (token.currentPosition >= 0 && token.currentPosition < 10) {
                token.model.rotation.y = Math.PI / 2 + Math.PI; 
            }
            // Pos 10-20: Left col, moving up.
            else if (token.currentPosition >= 10 && token.currentPosition < 20) {
                token.model.rotation.y = 0 + Math.PI;
            }
            // Pos 20-30: Top row, moving right. 
            else if (token.currentPosition >= 20 && token.currentPosition < 30) {
                token.model.rotation.y = -Math.PI / 2 + Math.PI;
            }
            // Pos 30-39: Right col, moving down.
            else if (token.currentPosition >= 30 && token.currentPosition < 40) {
                token.model.rotation.y = Math.PI + Math.PI;
            }
        }
    }

    async moveTokenAnimated(playerId, steps) {
        const token = this.tokens.find(t => t.id === playerId);
        if (!token) return;

        token.targetPosition = (token.currentPosition + steps) % 40;

        // Animate space by space
        while (token.currentPosition !== token.targetPosition) {
            token.currentPosition = (token.currentPosition + 1) % 40;
            this.updateTokenDOMPosition(token);
            // Wait for CSS transition (0.4s) before moving to next space
            await new Promise(r => setTimeout(r, 400));
        }
    }

    onResize() {
        // Re-calculate DOM positions for all tokens on resize
        this.tokens.forEach(token => this.updateTokenDOMPosition(token));
    }
}
