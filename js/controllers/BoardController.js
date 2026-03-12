import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

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
        
        this.floorPhysicsMaterial = null;
        this.clock = new THREE.Clock();
    }

    async init() {
        this.container = document.getElementById('game-container');
        if (!this.container) return;

        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x2c3e50); 

        const aspect = this.container.clientWidth / this.container.clientHeight;
        this.camera = new THREE.PerspectiveCamera(45, aspect, 0.1, 1000);
        this.camera.position.set(0, 90, 90); 
        this.camera.lookAt(0, 0, 0);

        this.renderer = new THREE.WebGLRenderer({ alpha: false, antialias: true });
        this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.container.appendChild(this.renderer.domElement);

        const pmremGenerator = new THREE.PMREMGenerator(this.renderer);
        this.scene.userData.envTexture = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;

        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.05;
        this.controls.maxPolarAngle = Math.PI / 2 - 0.1;
        this.controls.minDistance = 20;
        this.controls.maxDistance = 200;

        this.world = new CANNON.World({ gravity: new CANNON.Vec3(0, -90, 0) });
        this.floorPhysicsMaterial = new CANNON.Material();
        const floorShape = new CANNON.Plane();
        const floorBody = new CANNON.Body({ mass: 0, material: this.floorPhysicsMaterial });
        floorBody.addShape(floorShape);
        floorBody.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
        floorBody.position.set(0, 0.5, 0); 
        this.world.addBody(floorBody);

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

        // Luz ligeramente fría para resaltar el tono azulado
        const ambientLight = new THREE.AmbientLight(0xffffff, 1.0); 
        this.scene.add(ambientLight);
        
        const dirLight = new THREE.DirectionalLight(0xf0f8ff, 0.7); // Luz direccional "AliceBlue" (fría)
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

        this.generateBoard();
        window.addEventListener('resize', this.onResize.bind(this));
        this.animate();
    }

    getAlgecirasData() {
        return [
            { name: "SALIDA", type: 'corner' }, // 0
            { name: "Calle Tarifa", price: "M60", color: "#6C3717" }, 
            { name: "Caja Comunidad" }, // 2
            { name: "San Antonio", price: "M60", color: "#6C3717" }, 
            { name: "Impuesto Renta", price: "Paga M200" }, // 4
            { name: "Estación Renfe", price: "M200" }, // 5
            { name: "C. Convento", price: "M100", color: "#8AD0EF" }, 
            { name: "? Suerte" }, // 7
            { name: "Regino Mtz.", price: "M100", color: "#8AD0EF" }, 
            { name: "Plaza Alta", price: "M120", color: "#8AD0EF" }, 
            { name: "CÁRCEL", type: 'corner' }, // 10
            { name: "Las Acacias", price: "M140", color: "#D63384" }, 
            { name: "Endesa", price: "M150" }, // 12
            { name: "Paseo de C.", price: "M140", color: "#D63384" }, 
            { name: "V. del Carmen", price: "M160", color: "#D63384" }, 
            { name: "Puerto", price: "M200" }, // 15
            { name: "Parque M.\nCristina", price: "M180", color: "#F47D20" }, 
            { name: "Caja Comunidad" }, // 17
            { name: "Pza. Verboom", price: "M180", color: "#F47D20" }, 
            { name: "Calle Sevilla", price: "M200", color: "#F47D20" }, 
            { name: "PARKING\nGRATIS", type: 'corner' }, // 20
            { name: "El Rinconcillo", price: "M220", color: "#E31E24" }, 
            { name: "? Suerte" }, // 22
            { name: "S. José Artesano", price: "M220", color: "#E31E24" }, 
            { name: "La Ermita", price: "M240", color: "#E31E24" }, 
            { name: "Est. Autobús", price: "M200" }, // 25
            { name: "Getares", price: "M260", color: "#FFDE00" }, 
            { name: "San García", price: "M260", color: "#FFDE00" }, 
            { name: "Emalgesa", price: "M150" }, // 28
            { name: "El Saladillo", price: "M280", color: "#FFDE00" }, 
            { name: "A LA\nCÁRCEL", type: 'corner' }, // 30
            { name: "Pelayo", price: "M300", color: "#169A4C" }, 
            { name: "El Cobre", price: "M300", color: "#169A4C" }, 
            { name: "Caja Comunidad" }, // 33
            { name: "Los Pastores", price: "M320", color: "#169A4C" }, 
            { name: "Helipuerto", price: "M200" }, // 35
            { name: "? Suerte" }, // 36
            { name: "Punta Carnero", price: "M350", color: "#1262B3" }, 
            { name: "Impuesto Lujo", price: "Paga M100" }, // 38
            { name: "Bahía Algeciras", price: "M400", color: "#1262B3" } 
        ];
    }

    createSpaceTexture(spaceData, index) {
        const isCorner = (index % 10 === 0);
        const cw = isCorner ? 384 : 256;
        const ch = 384; 
        
        const canvas = document.createElement('canvas');
        canvas.width = cw;
        canvas.height = ch;
        const ctx = canvas.getContext('2d');

        const boardColor = '#CFE9DC'; // Light mint blue/green standard for Monopoly boards
        ctx.fillStyle = boardColor; 
        ctx.fillRect(0, 0, cw, ch);
        
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 4; 
        ctx.strokeRect(0, 0, cw, ch);

        ctx.save();
        
        if (isCorner) {
            ctx.translate(cw/2, ch/2);
            if (index === 20) ctx.rotate(3*Math.PI/4); 
            else if (index === 30) ctx.rotate(-3*Math.PI/4); 

            if (index === 0) {
                // SALIDA / GO Space
                ctx.fillStyle = boardColor; // Use uniform board color
                ctx.fillRect(-cw/2, -ch/2, cw, ch);
                ctx.strokeRect(-cw/2, -ch/2, cw, ch);
                
                // Red Arrow pointing Left
                ctx.fillStyle = '#E31E24';
                ctx.beginPath();
                ctx.moveTo(140, 60); 
                ctx.lineTo(-40, 60); 
                ctx.lineTo(-40, 30); 
                ctx.lineTo(-130, 90); 
                ctx.lineTo(-40, 150); 
                ctx.lineTo(-40, 120); 
                ctx.lineTo(140, 120); 
                ctx.closePath();
                ctx.fill(); 
                ctx.lineWidth = 4;
                ctx.strokeStyle = '#000';
                ctx.stroke();

                // "SALIDA" Text
                ctx.fillStyle = '#E31E24'; // Red text
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.font = 'bold 75px Arial';
                ctx.fillText("SALIDA", 0, -10);
                // Text stroke for better legibility
                ctx.lineWidth = 2;
                ctx.strokeStyle = '#000';
                ctx.strokeText("SALIDA", 0, -10);
                
                // Extra text
                ctx.fillStyle = '#000';
                ctx.font = 'bold 22px Arial';
                ctx.fillText("COBRE M200 CADA VEZ", 0, -110);
                ctx.fillText("QUE PASE POR AQUÍ", 0, -80);

            } else if (index === 10) {
                // CÁRCEL / Jail Space
                // Background
                ctx.fillStyle = boardColor; // Uniform board color
                ctx.fillRect(-cw/2, -ch/2, cw, ch);
                ctx.strokeRect(-cw/2, -ch/2, cw, ch);

                // Orange jail square in top-right area
                ctx.fillStyle = '#F47D20'; // Orange
                ctx.fillRect(-50, -192, 242, 242); 
                ctx.lineWidth = 6;
                ctx.strokeStyle = '#000';
                ctx.strokeRect(-50, -192, 242, 242);
                
                // Jail window background
                ctx.fillStyle = '#ffffff'; // White window
                ctx.fillRect(0, -142, 142, 80);
                ctx.strokeRect(0, -142, 142, 80);

                // Jail bars
                ctx.beginPath();
                for(let i=1; i<=4; i++) {
                    ctx.moveTo(0 + i*(142/5), -142);
                    ctx.lineTo(0 + i*(142/5), -62);
                }
                ctx.lineWidth = 4;
                ctx.stroke();

                ctx.fillStyle = '#000';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.font = 'bold 36px Arial';
                ctx.fillText("EN LA", 71, -165);
                ctx.fillText("CÁRCEL", 71, -30);

                ctx.save();
                ctx.translate(-121, -71);
                ctx.rotate(Math.PI/2);
                ctx.font = 'bold 36px Arial';
                ctx.fillText("SÓLO", 0, 0);
                ctx.restore();

                ctx.save();
                ctx.translate(71, 121);
                ctx.font = 'bold 36px Arial';
                ctx.fillText("VISITAS", 0, 0);
                ctx.restore();

            } else if (index === 20) {
                ctx.fillStyle = '#000';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.font = 'bold 45px Arial'; 
                ctx.fillText("PARKING", 0, -90);
                ctx.font = '100px Arial';
                ctx.fillText("🚗", 0, 10);
                ctx.font = 'bold 45px Arial'; 
                ctx.fillText("GRATUITO", 0, 110);
            } else if (index === 30) {
                ctx.fillStyle = '#000';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.font = 'bold 45px Arial'; 
                ctx.fillText("IR A LA", 0, -90);
                ctx.font = '100px Arial';
                ctx.fillText("👮", 0, 10);
                ctx.font = 'bold 45px Arial'; 
                ctx.fillText("CÁRCEL", 0, 110);
            }
        } else {
            if(spaceData.color) {
                ctx.fillStyle = spaceData.color;
                ctx.fillRect(0, 0, cw, 80);
                ctx.beginPath();
                ctx.lineWidth = 4;
                ctx.moveTo(0, 80); ctx.lineTo(cw, 80);
                ctx.stroke();
            }

            ctx.fillStyle = '#000';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            
            const hasColorHeader = !!spaceData.color;
            const nameY = hasColorHeader ? 120 : 70; 
            
            ctx.font = 'bold 28px Arial, sans-serif'; 
            
            if(spaceData.name.includes('\n')) {
               const lines = spaceData.name.split('\n');
               ctx.fillText(lines[0].toUpperCase(), cw/2, nameY);
               ctx.fillText(lines[1].toUpperCase(), cw/2, nameY + 30); 
            } else if(spaceData.name.length > 10 && spaceData.name.indexOf(' ') !== -1) {
               const parts = spaceData.name.split(' ');
               ctx.fillText(parts[0].toUpperCase(), cw/2, nameY);
               ctx.fillText(parts.slice(1).join(' ').toUpperCase(), cw/2, nameY + 30);
            } else {
               ctx.fillText(spaceData.name.toUpperCase(), cw/2, nameY + 15);
            }
            
            if(spaceData.price && !spaceData.name.includes("Impuesto")) {
               ctx.font = 'bold 26px Arial, sans-serif';
               ctx.fillText(spaceData.price.toUpperCase(), cw/2, ch - 25); 
               ctx.beginPath();
               ctx.lineWidth = 2; 
               ctx.moveTo(cw * 0.1, ch - 48);
               ctx.lineTo(cw * 0.9, ch - 48);
               ctx.stroke();
            } else if(spaceData.price && spaceData.name.includes("Impuesto")) {
               ctx.font = 'bold 28px Arial, sans-serif';
               ctx.fillText(spaceData.price.toUpperCase(), cw/2, ch - 40);
            }
            
            if(spaceData.name.includes("Comunidad") || spaceData.name.includes("Suerte")) {
               ctx.font = '90px Arial';
               ctx.fillText(spaceData.name.includes("Suerte") ? "❓" : "🎁", cw/2, ch/2 + 25);
            } else if(spaceData.name.includes("Renfe") || spaceData.name.includes("Autobús") || spaceData.name.includes("Helipuerto") || spaceData.name.includes("Puerto")) {
               ctx.font = '90px Arial';
               ctx.fillText("🚉", cw/2, ch/2 + 35);
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

        const boardColor = '#CFE9DC';
        ctx.fillStyle = boardColor;
        ctx.fillRect(0, 0, cw, ch);

        ctx.save();
        ctx.translate(cw/2, ch/2);
        ctx.rotate(-Math.PI / 4);

        ctx.fillStyle = '#E31E24';
        const logoW = 1500;
        const logoH = 320;
        ctx.fillRect(-logoW/2, -logoH/2, logoW, logoH);
        
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 12;
        ctx.strokeRect(-logoW/2 + 6, -logoH/2 + 6, logoW - 12, logoH - 12);
        
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 6;
        ctx.strokeRect(-logoW/2, -logoH/2, logoW, logoH);

        ctx.fillStyle = '#fff';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        
        ctx.font = 'bold 190px Arial, sans-serif';
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 10;
        ctx.lineJoin = "round";
        ctx.strokeText("MONOPOLY", 0, -35);
        ctx.fillText("MONOPOLY", 0, -35);
        
        ctx.fillStyle = '#000';
        ctx.font = 'bold 75px Arial, sans-serif';
        ctx.fillText("ALGECIRAS", 0, 100);
        ctx.restore();

        ctx.save();
        ctx.translate(cw * 0.72, ch * 0.72); 
        ctx.rotate(-Math.PI / 4);
        ctx.fillStyle = '#F47D20'; // Orange matched
        ctx.fillRect(-160, -220, 320, 440);
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 4;
        ctx.strokeRect(-160, -220, 320, 440);
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 200px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText("?", 0, 0);
        ctx.restore();

        ctx.save();
        ctx.translate(cw * 0.28, ch * 0.28); 
        ctx.rotate(-Math.PI / 4);
        ctx.fillStyle = '#8AD0EF'; // Light Blue matched
        ctx.fillRect(-160, -220, 320, 440);
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 4;
        ctx.strokeRect(-160, -220, 320, 440);
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
        const rowOffset = (9 * spaceW) / 2 + (spaceH / 2);

        const geometryNormal = new THREE.BoxGeometry(spaceW * 0.95, 1, spaceH * 0.95);
        const geometryCorner = new THREE.BoxGeometry(spaceH * 0.95, 1, spaceH * 0.95);
        
        for (let i = 0; i < 40; i++) {
            const isCorner = (i % 10 === 0);
            const geo = isCorner ? geometryCorner : geometryNormal;
            
            let x = 0; let z = 0; let rotationY = 0;
            
            if (i === 0) { x = rowOffset; z = rowOffset; } 
            else if (i < 10) { x = rowOffset - spaceH/2 - spaceW/2 - (i-1)*spaceW; z = rowOffset; rotationY = 0; }
            else if (i === 10) { x = -rowOffset; z = rowOffset; } 
            else if (i < 20) { x = -rowOffset; z = rowOffset - spaceH/2 - spaceW/2 - (i-11)*spaceW; rotationY = -Math.PI / 2; }
            else if (i === 20) { x = -rowOffset; z = -rowOffset; } 
            else if (i < 30) { x = -rowOffset + spaceH/2 + spaceW/2 + (i-21)*spaceW; z = -rowOffset; rotationY = Math.PI; }
            else if (i === 30) { x = rowOffset; z = -rowOffset; } 
            else if (i < 40) { x = rowOffset; z = -rowOffset + spaceH/2 + spaceW/2 + (i-31)*spaceW; rotationY = Math.PI / 2; }

            const spaceData = this.monopolyData[i];
            
            const sideMat = new THREE.MeshStandardMaterial({ 
                color: '#CFE9DC', // Uniform base board color
                roughness: 1.0,   
                metalness: 0.0
            });
            
            const topTexture = this.createSpaceTexture(spaceData, i);
            const topMat = new THREE.MeshStandardMaterial({ 
                map: topTexture,
                roughness: 1.0,   
                metalness: 0.0
            });
            
            const materials = [sideMat, sideMat, topMat, sideMat, sideMat, sideMat];
            const mesh = new THREE.Mesh(geo, materials);
            
            mesh.position.set(x, 0, z);
            if (!isCorner) mesh.rotation.y = rotationY;
            mesh.receiveShadow = true;
            mesh.castShadow = true;
            
            this.scene.add(mesh);
            this.spaceMeshes.push(mesh);
            this.spaceCoordinates[i] = new THREE.Vector3(x, 0.5, z);
        }
        
        const innerGeo = new THREE.PlaneGeometry(rowOffset*2 - spaceH, rowOffset*2 - spaceH);
        const centerTexture = this.createCenterTexture();
        
        const innerMat = new THREE.MeshStandardMaterial({ 
            map: centerTexture, 
            roughness: 1.0, 
            metalness: 0 
        });
        const innerMesh = new THREE.Mesh(innerGeo, innerMat);
        innerMesh.rotation.x = -Math.PI / 2;
        innerMesh.position.y = -0.49; 
        innerMesh.receiveShadow = true;
        this.scene.add(innerMesh);
    }

    animate() {
        requestAnimationFrame(this.animate.bind(this));
        const dt = this.clock.getDelta();
        if(this.world) this.world.step(1/60, Math.min(dt, 0.1), 3);
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