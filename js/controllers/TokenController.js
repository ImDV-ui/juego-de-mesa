import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

export default class TokenController {
    constructor() {
        this.tokens = [];
        this.scene = null;
        this.spaceCoordinates = [];
    }

    setupGlobalContext(scene, spaceCoordinates) {
        this.scene = scene;
        this.spaceCoordinates = spaceCoordinates;
    }

    init() {
        console.log('TokenController initializing (Global Context)...');
    }

    async createPlayerToken(playerId, modelPath) {
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
                    const scale = 2.5 / maxDim; // Fit within 3D board units (space size is 4.5)
                    model.scale.set(scale, scale, scale);
                    model.position.sub(center.multiplyScalar(scale)); // Center it
                    
                    // Recorrer el modelo para habilitar sombras y aplicar material CROMADO
                    model.traverse(c => {
                        if (c.isMesh) {
                            c.castShadow = true;
                            c.receiveShadow = true;
                            
                            // Material cromado perfecto que SOLO APLICA AL COCHE
                            c.material = new THREE.MeshStandardMaterial({
                                color: 0xffffff, // Base blanca pura
                                metalness: 1.0,  // 100% metal
                                roughness: 0.1,  // Muy pulido
                                envMap: this.scene.userData.envTexture, // <-- Usamos el entorno guardado
                                envMapIntensity: 1.5 // Aumentamos el reflejo
                            });
                        }
                    });

                    this.scene.add(model);
                    modelObj = model;
                    resolve();
                },
                undefined,
                (err) => reject(err)
            );
        });

        const token = {
            id: playerId,
            model: modelObj,
            currentPosition: 0,
            targetPosition: 0
        };

        this.tokens.push(token);

        // Place on Start
        this.updateToken3DPosition(token);
        
        return token;
    }

    updateToken3DPosition(token) {
        if (!token.model) return;
        
        const targetCoord = this.spaceCoordinates[token.currentPosition];
        if(!targetCoord) return;

        // Position model
        token.model.position.set(targetCoord.x, targetCoord.y, targetCoord.z);

        // Update 3D Model Rotation based on board side
        if (token.currentPosition >= 0 && token.currentPosition < 10) {
            token.model.rotation.y = Math.PI / 2 + Math.PI; 
        }
        else if (token.currentPosition >= 10 && token.currentPosition < 20) {
            token.model.rotation.y = 0 + Math.PI;
        }
        else if (token.currentPosition >= 20 && token.currentPosition < 30) {
            token.model.rotation.y = -Math.PI / 2 + Math.PI;
        }
        else if (token.currentPosition >= 30 && token.currentPosition < 40) {
            token.model.rotation.y = Math.PI + Math.PI;
        }
    }

    async moveTokenAnimated(playerId, steps) {
        const token = this.tokens.find(t => t.id === playerId);
        if (!token) return;

        token.targetPosition = (token.currentPosition + steps) % 40;

        while (token.currentPosition !== token.targetPosition) {
            token.currentPosition = (token.currentPosition + 1) % 40;
            await this.animateStep(token);
        }
    }

    async animateStep(token) {
        return new Promise(resolve => {
            const startPos = token.model.position.clone();
            const endCoord = this.spaceCoordinates[token.currentPosition];
            const endPos = new THREE.Vector3(endCoord.x, endCoord.y, endCoord.z);
            
            this.updateToken3DPosition(token);
            token.model.position.copy(startPos); 

            const frames = 20;
            let currentFrame = 0;
            const hopHeight = 3.0; 
            
            const animateHop = () => {
                currentFrame++;
                const progress = currentFrame / frames; 
                
                token.model.position.lerpVectors(startPos, endPos, progress);
                
                const arc = Math.sin(progress * Math.PI) * hopHeight;
                token.model.position.y += arc;

                if (currentFrame < frames) {
                    requestAnimationFrame(animateHop);
                } else {
                    token.model.position.copy(endPos); 
                    resolve();
                }
            };
            
            animateHop();
        });
    }
}