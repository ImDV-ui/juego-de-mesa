import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

export default class BoardController {
    constructor() {
        this.container = null;
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.controls = null;
        this.world = null;
        
        this.spaceCoordinates = [];
        this.spaceMeshes = [];
        this.monopolyData = this.getAlgecirasData();
        
        // Expose materials so other controllers can use them if needed.
        this.floorPhysicsMaterial = null;
        this.clock = new THREE.Clock();
    }

    async init() {
        console.log('BoardController initializing (Global 3D Environment)...');
        
        this.container = document.getElementById('game-container');
        if (!this.container) {
            console.error("Game container not found!");
            return;
        }

        // 1. Setup global Three.js Scene
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x2c3e50);

        const aspect = this.container.clientWidth / this.container.clientHeight;
        this.camera = new THREE.PerspectiveCamera(45, aspect, 0.1, 1000);
        this.camera.position.set(0, 90, 90); // Isometric-ish view from front-bottom
        this.camera.lookAt(0, 0, 0);

        this.renderer = new THREE.WebGLRenderer({ alpha: false, antialias: true });
        this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.container.appendChild(this.renderer.domElement);

        // OrbitControls
        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.05;
        this.controls.maxPolarAngle = Math.PI / 2 - 0.1; // Don't allow going below ground
        this.controls.minDistance = 20;
        this.controls.maxDistance = 200;

        // 2. Global Cannon Physics World
        this.world = new CANNON.World({
            gravity: new CANNON.Vec3(0, -90, 0), // Stronger gravity so dice fall faster
        });

        // Setup Physics Materials & Floor
        this.floorPhysicsMaterial = new CANNON.Material();
        
        const floorShape = new CANNON.Plane();
        const floorBody = new CANNON.Body({ mass: 0, material: this.floorPhysicsMaterial });
        floorBody.addShape(floorShape);
        floorBody.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
        floorBody.position.set(0, 0.5, 0); // Put exactly on top surface of board meshes
        this.world.addBody(floorBody);

        // Invisible walls to keep dice on board (Slightly larger than the board itself)
        const wallOffset = 30;
        const wallShape = new CANNON.Box(new CANNON.Vec3(wallOffset, 50, 1));
        const walls = [
            { pos: [0, 0, wallOffset], rot: [0, 0, 0] },     
            { pos: [0, 0, -wallOffset], rot: [0, Math.PI, 0] },    
            { pos: [wallOffset, 0, 0], rot: [0, -Math.PI/2, 0] },  
            { pos: [-wallOffset, 0, 0], rot: [0, Math.PI/2, 0] }  
        ];
        walls.forEach(w => {
            const wallBody = new CANNON.Body({ mass: 0, material: this.floorPhysicsMaterial });
            wallBody.addShape(wallShape);
            wallBody.position.set(...w.pos);
            wallBody.quaternion.setFromEuler(...w.rot);
            this.world.addBody(wallBody);
        });

        // 3. Lighting
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
        this.scene.add(ambientLight);
        
        const dirLight = new THREE.DirectionalLight(0xffffff, 1.3);
        dirLight.position.set(20, 80, 20);
        dirLight.castShadow = true;
        dirLight.shadow.mapSize.width = 2048;
        dirLight.shadow.mapSize.height = 2048;
        dirLight.shadow.camera.left = -40;
        dirLight.shadow.camera.right = 40;
        dirLight.shadow.camera.top = 40;
        dirLight.shadow.camera.bottom = -40;
        dirLight.shadow.bias = -0.0005;
        this.scene.add(dirLight);

        // 4. Generate 3D Board
        this.generateBoard();

        // Resize handler
        window.addEventListener('resize', this.onResize.bind(this));

        // Start Loop
        this.animate();
        console.log('BoardController setup complete.');
    }

    getAlgecirasData() {
        return [
            { name: "SALIDA", type: 'corner' }, // 0
            { name: "Calle Tarifa", price: "M60", color: "#8b4513" }, // 1
            { name: "Caja Comunidad" }, // 2
            { name: "San Antonio", price: "M60", color: "#8b4513" }, // 3
            { name: "Impuesto Renta", price: "Paga M200" }, // 4
            { name: "Estación Renfe", price: "M200" }, // 5
            { name: "C. Convento", price: "M100", color: "#add8e6" }, // 6
            { name: "? Suerte" }, // 7
            { name: "Regino Mtz.", price: "M100", color: "#add8e6" }, // 8
            { name: "Plaza Alta", price: "M120", color: "#add8e6" }, // 9
            { name: "CÁRCEL", type: 'corner' }, // 10
            { name: "Las Acacias", price: "M140", color: "#ff1493" }, // 11
            { name: "Endesa", price: "M150" }, // 12
            { name: "Paseo de C.", price: "M140", color: "#ff1493" }, // 13
            { name: "V. del Carmen", price: "M160", color: "#ff1493" }, // 14
            { name: "Puerto", price: "M200" }, // 15
            { name: "Parque M.\nCristina", price: "M180", color: "#ffa500" }, // 16
            { name: "Caja Comunidad" }, // 17
            { name: "Pza. Verboom", price: "M180", color: "#ffa500" }, // 18
            { name: "Calle Sevilla", price: "M200", color: "#ffa500" }, // 19
            { name: "PARKING\nGRATIS", type: 'corner' }, // 20
            { name: "El Rinconcillo", price: "M220", color: "#ff0000" }, // 21
            { name: "? Suerte" }, // 22
            { name: "S. José Artesano", price: "M220", color: "#ff0000" }, // 23
            { name: "La Ermita", price: "M240", color: "#ff0000" }, // 24
            { name: "Est. Autobús", price: "M200" }, // 25
            { name: "Getares", price: "M260", color: "#ffeb3b" }, // 26
            { name: "San García", price: "M260", color: "#ffeb3b" }, // 27
            { name: "Emalgesa", price: "M150" }, // 28
            { name: "El Saladillo", price: "M280", color: "#ffeb3b" }, // 29
            { name: "A LA\nCÁRCEL", type: 'corner' }, // 30
            { name: "Pelayo", price: "M300", color: "#008000" }, // 31
            { name: "El Cobre", price: "M300", color: "#008000" }, // 32
            { name: "Caja Comunidad" }, // 33
            { name: "Los Pastores", price: "M320", color: "#008000" }, // 34
            { name: "Helipuerto", price: "M200" }, // 35
            { name: "? Suerte" }, // 36
            { name: "Punta Carnero", price: "M350", color: "#00008b" }, // 37
            { name: "Impuesto Lujo", price: "Paga M100" }, // 38
            { name: "Bahía Algeciras", price: "M400", color: "#00008b" } // 39
        ];
    }

    createSpaceTexture(spaceData, index) {
        const isCorner = (index % 10 === 0);
        const cw = isCorner ? 384 : 256;
        const ch = isCorner ? 384 : 384; 
        
        const canvas = document.createElement('canvas');
        canvas.width = cw;
        canvas.height = ch;
        const ctx = canvas.getContext('2d');

        // Background (Tono verde pálido clásico de Monopoly)
        ctx.fillStyle = '#cde2c9';
        ctx.fillRect(0, 0, cw, ch);
        
        // Border
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 4;
        ctx.strokeRect(0, 0, cw, ch);

        ctx.save();
        
        if (isCorner) {
            ctx.translate(cw/2, ch/2);
            // Orient appropriately diagonal
            if (index === 0) ctx.rotate(-Math.PI/4); // Go
            else if (index === 10) ctx.rotate(Math.PI/4); // Jail
            else if (index === 20) ctx.rotate(3*Math.PI/4); // Parking
            else if (index === 30) ctx.rotate(-3*Math.PI/4); // Go to Jail
            ctx.translate(-cw/2, -ch/2); 
            
            ctx.fillStyle = '#000';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.font = '900 62px Inter, Arial'; // Extra bold, larger
            
            const lines = spaceData.name.split('\n');
            if(lines.length === 1) {
                if(index === 0) { ctx.fillStyle = '#e74c3c'; ctx.font = '900 85px Inter, Arial'; }
                ctx.fillText(lines[0], cw/2, ch/2);
            } else {
                ctx.fillText(lines[0], cw/2, ch/2 - 35);
                ctx.fillText(lines[1], cw/2, ch/2 + 35);
            }
        } else {
            // Normal space
            // Color bar at top (V=1 is the top edge, meaning it faces center if rotation=0)
            if(spaceData.color) {
                ctx.fillStyle = spaceData.color;
                ctx.fillRect(0, 0, cw, 70);
                ctx.lineWidth = 4;
                ctx.strokeRect(0, 0, cw, 70);
            }

            ctx.fillStyle = '#000';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            
            const hasColorHeader = !!spaceData.color;
            const nameY = hasColorHeader ? 120 : 70; // Adjusted for bigger text
            
            // Scaled fonts up for legibility
            ctx.font = '900 42px Inter, Arial'; // Extra bold, much larger
            
            if(spaceData.name.includes('\n')) {
               const lines = spaceData.name.split('\n');
               ctx.fillText(lines[0], cw/2, nameY);
               ctx.fillText(lines[1], cw/2, nameY + 42); // increased line height
            } else if(spaceData.name.length > 9 && spaceData.name.indexOf(' ') !== -1) {
               // Auto-wrap long names that have spaces, wrap earlier for big text
               const parts = spaceData.name.split(' ');
               ctx.fillText(parts[0], cw/2, nameY);
               ctx.fillText(parts.slice(1).join(' '), cw/2, nameY + 42);
            } else {
               ctx.fillText(spaceData.name, cw/2, nameY + 16);
            }
            
            if(spaceData.price && !spaceData.name.includes("Impuesto")) {
               ctx.font = 'bold 36px Inter, Arial';
               ctx.fillText(spaceData.price, cw/2, ch - 26); // Move price slightly up
               
               // top border above price
               ctx.beginPath();
               ctx.lineWidth = 3;
               ctx.moveTo(15, ch - 55);
               ctx.lineTo(cw - 15, ch - 55);
               ctx.stroke();
            } else if(spaceData.price && spaceData.name.includes("Impuesto")) {
               // Impuestos carry text like "Paga M200", render big
               ctx.font = '900 38px Inter, Arial';
               ctx.fillText(spaceData.price, cw/2, ch - 40);
            }
            
            // Icons centered perfectly in the remaining empty space between text and price
            if(spaceData.name.includes("Comunidad") || spaceData.name.includes("Suerte")) {
               ctx.font = '90px Arial';
               ctx.fillText(spaceData.name.includes("Suerte") ? "❓" : "🎁", cw/2, ch/2 + 25);
            } else if(spaceData.name.includes("Renfe") || spaceData.name.includes("Autobús") || spaceData.name.includes("Helipuerto") || spaceData.name.includes("Puerto")) {
               ctx.font = '90px Arial';
               ctx.fillText("🚉", cw/2, ch/2 + 25);
            } else if(spaceData.name.includes("Impuesto")) {
               ctx.font = '90px Arial';
               ctx.fillText("💍", cw/2, ch/2);
            }
        }

        ctx.restore();

        const texture = new THREE.CanvasTexture(canvas);
        texture.anisotropy = this.renderer.capabilities.getMaxAnisotropy();
        return texture;
    }

    createCenterTexture() {
        const cw = 2048;
        const ch = 2048;
        const canvas = document.createElement('canvas');
        canvas.width = cw;
        canvas.height = ch;
        const ctx = canvas.getContext('2d');

        // Background
        ctx.fillStyle = '#cde2c9';
        ctx.fillRect(0, 0, cw, ch);

        ctx.save();
        ctx.translate(cw/2, ch/2);
        
        // Diagonal rotation for the main logo (bottom-left to top-right)
        ctx.rotate(-Math.PI / 4);

        // Red background for Monopoly logo
        ctx.fillStyle = '#ed1c24';
        const logoW = 1400;
        const logoH = 300;
        ctx.fillRect(-logoW/2, -logoH/2, logoW, logoH);
        
        // White border
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 15;
        ctx.strokeRect(-logoW/2, -logoH/2, logoW, logoH);
        
        // Black outline
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 8;
        ctx.strokeRect(-logoW/2 - 4, -logoH/2 - 4, logoW + 8, logoH + 8);

        // Text
        ctx.fillStyle = '#fff';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        
        ctx.font = 'bold 180px Arial';
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 12;
        ctx.lineJoin = "round";
        ctx.strokeText("MONOPOLY", 0, -25);
        ctx.fillText("MONOPOLY", 0, -25);
        
        ctx.font = 'bold 60px Arial';
        ctx.strokeText("ALGECIRAS", 0, 80);
        ctx.fillText("ALGECIRAS", 0, 80);

        ctx.restore();

        // Orange Chance Card (Bottom Right)
        ctx.save();
        ctx.translate(cw * 0.75, ch * 0.75); 
        ctx.rotate(-Math.PI / 4);
        ctx.fillStyle = '#f7941d'; 
        ctx.fillRect(-180, -240, 360, 480);
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 4;
        ctx.strokeRect(-180, -240, 360, 480);
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 200px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText("?", 0, 0);
        ctx.restore();

        // Blue Community Chest Card (Top Left)
        ctx.save();
        ctx.translate(cw * 0.25, ch * 0.25); 
        ctx.rotate(-Math.PI / 4);
        ctx.fillStyle = '#6dcff6'; 
        ctx.fillRect(-180, -240, 360, 480);
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 4;
        ctx.strokeRect(-180, -240, 360, 480);
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 160px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText("🎁", 0, 0);
        ctx.restore();

        const texture = new THREE.CanvasTexture(canvas);
        texture.anisotropy = this.renderer.capabilities.getMaxAnisotropy();
        return texture;
    }

    generateBoard() {
        const spaceW = 4.6;
        const spaceH = 7.0;
        const rowOffset = (9 * spaceW) / 2 + (spaceH / 2); // 24.2

        const geometryNormal = new THREE.BoxGeometry(spaceW * 0.95, 1, spaceH * 0.95);
        const geometryCorner = new THREE.BoxGeometry(spaceH * 0.95, 1, spaceH * 0.95);
        
        for (let i = 0; i < 40; i++) {
            const isCorner = (i % 10 === 0);
            const geo = isCorner ? geometryCorner : geometryNormal;
            
            let x = 0;
            let z = 0;
            let rotationY = 0;
            
            if (i === 0) { x = rowOffset; z = rowOffset; } // Go
            else if (i < 10) { x = rowOffset - spaceH/2 - spaceW/2 - (i-1)*spaceW; z = rowOffset; rotationY = 0; }
            else if (i === 10) { x = -rowOffset; z = rowOffset; } // Jail
            else if (i < 20) { x = -rowOffset; z = rowOffset - spaceH/2 - spaceW/2 - (i-11)*spaceW; rotationY = -Math.PI / 2; }
            else if (i === 20) { x = -rowOffset; z = -rowOffset; } // Parking
            else if (i < 30) { x = -rowOffset + spaceH/2 + spaceW/2 + (i-21)*spaceW; z = -rowOffset; rotationY = Math.PI; }
            else if (i === 30) { x = rowOffset; z = -rowOffset; } // Go to Jail
            else if (i < 40) { x = rowOffset; z = -rowOffset + spaceH/2 + spaceW/2 + (i-31)*spaceW; rotationY = Math.PI / 2; }

            const spaceData = this.monopolyData[i];
            
            const sideMat = new THREE.MeshStandardMaterial({ 
                color: '#cde2c9', // Igual que el fondo superior
                roughness: 0.8,
                metalness: 0.05
            });
            
            const topTexture = this.createSpaceTexture(spaceData, i);
            const topMat = new THREE.MeshStandardMaterial({ 
                map: topTexture,
                roughness: 0.6,
                metalness: 0.05
            });
            
            const materials = [sideMat, sideMat, topMat, sideMat, sideMat, sideMat];
            const mesh = new THREE.Mesh(geo, materials);
            
            mesh.position.set(x, 0, z);
            if (!isCorner) mesh.rotation.y = rotationY;
            mesh.receiveShadow = true;
            mesh.castShadow = true;
            
            this.scene.add(mesh);
            this.spaceMeshes.push(mesh);

            // Vector3 where the token sits: Top is 0.5 + margin 
            this.spaceCoordinates[i] = new THREE.Vector3(x, 0.5, z);
        }
        
        // Inner board floor (the center area table mat)
        const innerGeo = new THREE.PlaneGeometry(rowOffset*2 - spaceH, rowOffset*2 - spaceH);
        
        const centerTexture = this.createCenterTexture();
        const innerMat = new THREE.MeshStandardMaterial({ 
            map: centerTexture, 
            roughness: 0.9, 
            metalness: 0 
        });
        const innerMesh = new THREE.Mesh(innerGeo, innerMat);
        innerMesh.rotation.x = -Math.PI / 2;
        innerMesh.position.y = -0.49; // Slightly below the boxes
        innerMesh.receiveShadow = true;
        this.scene.add(innerMesh);
    }

    animate() {
        requestAnimationFrame(this.animate.bind(this));
        
        const dt = this.clock.getDelta();
        if(this.world) {
            this.world.step(1/60, Math.min(dt, 0.1), 3);
        }
        
        if (this.controls) this.controls.update();

        if (this.renderer && this.scene && this.camera) {
            this.renderer.render(this.scene, this.camera);
        }
    }

    onResize() {
        if (!this.container || !this.camera || !this.renderer) return;
        const width = this.container.clientWidth;
        const height = this.container.clientHeight;
        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(width, height);
    }
}
