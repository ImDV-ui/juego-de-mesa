import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';
import { MTLLoader } from 'three/addons/loaders/MTLLoader.js';

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
        let modelObj = null;
        
        const isOBJ = modelPath.toLowerCase().endsWith('.obj');

        if (isOBJ) {
            // Load OBJ/MTL
            const mtlPath = modelPath.replace('.obj', '.mtl');
            const mtlLoader = new MTLLoader();
            
            const materials = await new Promise((resolve, reject) => {
                mtlLoader.load(mtlPath, resolve, undefined, reject);
            });
            materials.preload();

            const objLoader = new OBJLoader();
            objLoader.setMaterials(materials);
            
            modelObj = await new Promise((resolve, reject) => {
                objLoader.load(modelPath, resolve, undefined, reject);
            });
        } else {
            // Load GLTF
            const loader = new GLTFLoader();
            await new Promise((resolve, reject) => {
                loader.load(
                    modelPath,
                    (gltf) => {
                        modelObj = gltf.scene;
                        resolve();
                    },
                    undefined,
                    (err) => reject(err)
                );
            });
        }

        // Common processing for both formats
        if (modelObj) {
            // Center and scale model
            const box = new THREE.Box3().setFromObject(modelObj);
            const center = box.getCenter(new THREE.Vector3());
            const size = box.getSize(new THREE.Vector3());
            const maxDim = Math.max(size.x, size.y, size.z);
            const scale = 6.0 / maxDim; // Increased further to 6.0 for maximum visibility
            modelObj.scale.set(scale, scale, scale);
            modelObj.position.sub(center.multiplyScalar(scale)); // Center it
            
            // Recorrer el modelo para habilitar sombras y aplicar material CROMADO
            modelObj.traverse(c => {
                if (c.isMesh) {
                    c.castShadow = true;
                    c.receiveShadow = true;
                    
                    // Material cromado perfecto
                    c.material = new THREE.MeshStandardMaterial({
                        color: 0xffffff,
                        metalness: 1.0,
                        roughness: 0.1,
                        envMap: this.scene.userData.envTexture,
                        envMapIntensity: 1.5
                    });
                }
            });

            this.scene.add(modelObj);
        }

        const token = {
            id: playerId,
            gridIndex: this.tokens.length, // 0, 1, 2, 3
            model: modelObj,
            currentPosition: 0,
            targetPosition: 0
        };

        this.tokens.push(token);

        // Place on Start
        this.updateToken3DPosition(token);
        
        return token;
    }

    getOffset(gridIndex, posIndex) {
        // Determinamos el desplazamiento basado en el índice del jugador (0-3)
        // Usamos una cuadrícula de 2x2
        const offsetX = (gridIndex % 2 === 0 ? -3.5 : 3.5);
        const offsetZ = (gridIndex < 2 ? -3.5 : 3.5);
        
        const side = Math.floor(posIndex / 10);
        
        // Rotamos el offset según el lado del tablero para que siempre queden "paralelos"
        if (side === 0 || side === 2) {
            return { x: offsetX, z: offsetZ };
        } else {
            // En los laterales (11-19 y 31-39), intercambiamos ejes
            return { x: offsetZ, z: offsetX };
        }
    }

    updateToken3DPosition(token) {
        if (!token.model) return;
        
        const baseCoord = this.spaceCoordinates[token.currentPosition];
        if(!baseCoord) return;

        const offset = this.getOffset(token.gridIndex, token.currentPosition);
        
        // Position model with offset
        token.model.position.set(
            baseCoord.x + offset.x, 
            baseCoord.y, 
            baseCoord.z + offset.z
        );

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
            const offset = this.getOffset(token.gridIndex, token.currentPosition);
            const endPos = new THREE.Vector3(endCoord.x + offset.x, endCoord.y, endCoord.z + offset.z);
            
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