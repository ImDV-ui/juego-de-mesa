import DiceController from './DiceController.js';
import DragController from './DragController.js';
import TokenController from './TokenController.js';
import BoardController from './BoardController.js';
import BankController from './BankController.js';
import Player from '../models/Player.js';

export default class GameController {
    constructor() {
        this.gameState = {
            players: [],
            currentPlayerIndex: 0,
            properties: [],
            isGameOver: false
        };
        // Controla el estado del pago actual (si es compra, alquiler, a quién se le paga...)
        this.currentPayment = { active: false, due: 0, paid: 0, type: null, space: null, owner: null };

        this.boardController = new BoardController();
        this.diceController = new DiceController();
        this.dragController = new DragController();
        this.tokenController = new TokenController();
        this.bankController = new BankController();
        this.cards = { luck: [], community: [] };
    }

    async init() {
        console.log('GameController initializing...');
        await this.loadProperties();
        await this.loadCards();
        
        await this.boardController.init();
        this.setupPaymentUI();
        
        this.diceController.setupGlobalContext(this.boardController.scene, this.boardController.world, this.boardController.floorPhysicsMaterial);
        await this.diceController.init();
        this.dragController.init();
        
        this.tokenController.setupGlobalContext(this.boardController.scene, this.boardController.spaceCoordinates);
        this.tokenController.init();

        this.setupMenu();
        
        this.diceController.onRollComplete = async (results, total) => {
            await this.handlePlayerMove(total);
        };
        this.setupInventoryPanel();
        this.setupWalletToggle();
        this.setupPaymentCancel();
    }

    setupMenu() {
        const pCountRadios = document.querySelectorAll('input[name="p-count"]');
        const configContainer = document.getElementById('player-configs');
        const startBtn = document.getElementById('btn-start-game');

        const updateInputs = (count) => {
            configContainer.innerHTML = '';
            const defaultColors = ["#ff4757", "#1e90ff", "#2ed573", "#ffa502"];
            const colorNames = ["Rojo", "Azul", "Verde", "Amarillo"];

            for (let i = 0; i < count; i++) {
                const item = document.createElement('div');
                item.className = 'player-config-item';
                item.innerHTML = `
                    <h3>Jugador ${i + 1}</h3>
                    <input type="text" class="p-name-input" placeholder="Nombre" value="Jugador ${i + 1}">
                    <div class="color-selector">
                        ${defaultColors.map((c, idx) => `
                            <label class="color-chip">
                                <input type="radio" name="p-color-${i}" value="${c}" ${idx === i ? 'checked' : ''}>
                                <span style="background-color: ${c}"></span>
                            </label>
                        `).join('')}
                    </div>
                `;
                configContainer.appendChild(item);
            }
        };

        pCountRadios.forEach(r => r.addEventListener('change', (e) => updateInputs(parseInt(e.target.value))));
        
        // Init with default (4)
        updateInputs(4);

        startBtn.addEventListener('click', () => this.handleStartGame());
    }

    async handleStartGame() {
        const configItems = document.querySelectorAll('.player-config-item');
        const playersConfig = [];

        for (let i = 0; i < configItems.length; i++) {
            const name = configItems[i].querySelector('.p-name-input').value.trim();
            const color = configItems[i].querySelector('input[name="p-color-' + i + '"]:checked').value;
            
            if (!name) {
                alert("Por favor, introduce un nombre para el Jugador " + (i + 1));
                return;
            }
            playersConfig.push({ name, color });
        }

        // Crear jugadores
        playersConfig.forEach((conf, idx) => {
            const p = new Player(idx + 1, conf.name, conf.color);
            this.gameState.players.push(p);
            this.bankController.distributeInitialMoney(p);
        });

        // Crear tokens 3D
        for (let i = 0; i < this.gameState.players.length; i++) {
            await this.tokenController.createPlayerToken(this.gameState.players[i].id, './assets/fichas/monopoly_car.glb');
            const token = this.tokenController.tokens.find(t => t.id === this.gameState.players[i].id);
            token.model.traverse(child => {
                if (child.isMesh) {
                    child.material = child.material.clone();
                    child.material.color.set(this.gameState.players[i].color);
                }
            });
        }

        // Update UI
        const firstPlayer = this.gameState.players[0];
        this.updatePlayerWalletUI(firstPlayer);
        this.updatePlayerInventoryUI(firstPlayer);
        this.updateTurnUI();

        // Ocultar Overlay
        document.getElementById('setup-overlay').classList.add('hidden');
    }

    setupWalletToggle() {
        const toggleWalletBtn = document.getElementById('toggle-wallet-btn');
        if (toggleWalletBtn) {
            toggleWalletBtn.addEventListener('click', () => {
                const wallet = document.getElementById('player-wallet');
                wallet.classList.toggle('collapsed');
                toggleWalletBtn.innerText = wallet.classList.contains('collapsed') ? '➡ Mostrar' : '⬅ Ocultar';
            });
        }
    }

    setupPaymentCancel() {
        const cancelBtn = document.getElementById('btn-cancel-buy');
        if(cancelBtn) {
            cancelBtn.addEventListener('click', () => {
                if(this.currentPayment.paid > 0) {
                     this.bankController.receiveFromBank(this.gameState.players[this.gameState.currentPlayerIndex], this.currentPayment.paid);
                     this.updatePlayerWalletUI(this.gameState.players[this.gameState.currentPlayerIndex]);
                }
                this.closePaymentModal();
            });
        }
    }

    setupInventoryPanel() {
        const toggleBtn = document.getElementById('inv-toggle-btn');
        const panel = document.getElementById('inventory-panel');
        if (toggleBtn && panel) {
            toggleBtn.addEventListener('click', () => panel.classList.toggle('open'));
        }

        const closeBtn = document.getElementById('prop-detail-close');
        const backdrop = document.getElementById('prop-detail-backdrop');
        const modal = document.getElementById('prop-detail-modal');
        if (closeBtn && modal) closeBtn.addEventListener('click', () => modal.classList.add('hidden'));
        if (backdrop && modal) backdrop.addEventListener('click', () => modal.classList.add('hidden'));
    }

    updatePlayerInventoryUI(player) {
        const container = document.getElementById('inventory-cards');
        const countEl = document.getElementById('inv-count');
        if (!container) return;

        if (countEl) countEl.textContent = player.properties.length;

        if (player.properties.length === 0) {
            container.innerHTML = '<p class="inventory-empty">Sin propiedades aún</p>';
            return;
        }

        container.innerHTML = '';
        player.properties.forEach(prop => {
            const isStation = prop.type === 'station';
            const color = prop.color || (isStation ? '#333' : '#5f27cd');
            const icon = prop.color ? '🏠' : (isStation ? '🚉' : '🏢');
            const baseRent = prop.rent ? prop.rent[0] : null;

            const row = document.createElement('div');
            row.className = 'inv-card-row';
            row.innerHTML = `
                <span class="inv-row-dot" style="background:${color};"></span>
                <span class="inv-row-name">${icon} ${prop.name}</span>
                <span class="inv-row-price">${baseRent !== null ? `$${baseRent}` : '—'}</span>
            `;

            // Click opens the detail modal
            row.addEventListener('click', () => this.openPropertyDetail(prop));
            container.appendChild(row);
        });
    }

    openPropertyDetail(prop) {
        const modal = document.getElementById('prop-detail-modal');
        const colorEl = document.getElementById('prop-detail-color');
        const nameEl = document.getElementById('prop-detail-name');
        const iconEl = document.getElementById('prop-detail-icon');
        const tableEl = document.getElementById('prop-detail-table');
        if (!modal) return;

        const isStation = prop.type === 'station';
        const color = prop.color || (isStation ? '#333' : '#5f27cd');
        const icon = prop.color ? '🏠' : (isStation ? '🚉' : '🏢');

        colorEl.style.background = color;
        nameEl.textContent = prop.name;
        nameEl.style.color = prop.color ? '#222' : '#fff';
        nameEl.style.textShadow = prop.color ? '1px 1px 0 rgba(255,255,255,0.7)' : '1px 1px 0 rgba(0,0,0,0.5)';
        iconEl.textContent = icon;

        const rentLabels = isStation
            ? ['×1 Estación', '×2 Estaciones', '×3 Estaciones', '×4 Estaciones']
            : ['Sin casas', '🏠 ×1', '🏠 ×2', '🏠 ×3', '🏠 ×4', '🏨 Hotel'];

        let rows = `
            <tr class="pd-section"><td colspan="2">💰 Compra</td></tr>
            <tr class="pd-row"><td>Precio</td><td>$${prop.price ?? '—'}</td></tr>
            ${prop.mortgage ? `<tr class="pd-row"><td>Hipoteca</td><td>$${prop.mortgage}</td></tr>` : ''}
            ${prop.houseCost ? `<tr class="pd-row"><td>Casa / Hotel</td><td>$${prop.houseCost}</td></tr>` : ''}
        `;

        if (prop.rent && prop.rent.length) {
            rows += `<tr class="pd-section"><td colspan="2">🏠 Alquileres</td></tr>`;
            prop.rent.forEach((val, i) => {
                rows += `<tr class="pd-row"><td>${rentLabels[i] ?? `Nivel ${i}`}</td><td>$${val}</td></tr>`;
            });
        }

        tableEl.innerHTML = `<tbody>${rows}</tbody>`;
        modal.classList.remove('hidden');
    }


    updatePlayerWalletUI(player) {
        document.getElementById('wallet-player-name').innerText = player.name;
        document.getElementById('wallet-total-money').innerText = `$${player.getTotalMoney()}`;
        
        const denominations = [500, 100, 50, 20, 10, 5, 1];
        denominations.forEach(denom => {
            const qty = player.wallet[denom];
            document.getElementById(`qty-${denom}`).innerText = qty;
            
            const img = document.querySelector(`.bill-item img[data-denomination="${denom}"]`);
            if (img) {
                if (qty > 0) {
                    img.setAttribute('draggable', 'true');
                    img.style.filter = 'none';
                    img.style.cursor = 'grab';
                } else {
                    img.setAttribute('draggable', 'false');
                    img.style.filter = 'grayscale(100%) opacity(0.5)';
                    img.style.cursor = 'not-allowed';
                }
            }
        });
    }

    setupPaymentUI() {
        const bills = document.querySelectorAll('.bill-img');
        bills.forEach(bill => {
            bill.addEventListener('dragstart', (e) => {
                if (e.target.getAttribute('draggable') === 'false') { e.preventDefault(); return; }
                const denom = e.target.getAttribute('data-denomination');
                e.dataTransfer.setData('text/plain', denom);
            });
        });

        const dropzone = document.getElementById('payment-dropzone');
        if (!dropzone) return;

        dropzone.addEventListener('dragover', (e) => {
            e.preventDefault();
            dropzone.classList.add('dragover');
        });

        dropzone.addEventListener('dragleave', () => dropzone.classList.remove('dragover'));

        dropzone.addEventListener('drop', (e) => {
            e.preventDefault();
            dropzone.classList.remove('dragover');
            
            const denomStr = e.dataTransfer.getData('text/plain');
            if (!denomStr) return;
            const denom = parseInt(denomStr, 10);
            
            // El jugador actual que tiene que pagar
            const player = this.gameState.players[this.gameState.currentPlayerIndex]; 
            
            if (this.currentPayment.active && player.wallet[denom] > 0) {
                // Le quitamos el billete de la mano
                player.wallet[denom] -= 1;
                this.currentPayment.paid += denom;
                
                this.updatePlayerWalletUI(player);
                document.getElementById('payment-paid').innerText = `$${this.currentPayment.paid}`;
                
                // === LÓGICA CUANDO EL PAGO SE COMPLETA ===
                if (this.currentPayment.paid >= this.currentPayment.due) {
                    const change = this.currentPayment.paid - this.currentPayment.due;
                    
                    if (this.currentPayment.type === 'buy') {
                        // COMPRA DE PROPIEDAD: El banco devuelve el cambio si sobra
                        if (change > 0) this.bankController.receiveFromBank(player, change);
                        
                        // Le damos la propiedad al jugador
                        this.currentPayment.space.owner = player;
                        player.properties.push(this.currentPayment.space);
                        console.log(`¡${player.name} compró ${this.currentPayment.space.name}!`);
                        this.updatePlayerInventoryUI(player);

                    } else if (this.currentPayment.type === 'rent') {
                        // PAGO DE ALQUILER: El dinero va al OTRO jugador
                        console.log(`Pagando alquiler a ${this.currentPayment.owner.name}`);
                        // Le damos el importe exacto de la deuda al propietario
                        this.bankController.receiveFromBank(this.currentPayment.owner, this.currentPayment.due);
                        
                        // Si el que paga metió billetes más grandes, el BANCO le da el cambio
                        if (change > 0) this.bankController.receiveFromBank(player, change);

                    } else if (this.currentPayment.type === 'tax') {
                        // PAGO DE IMPUESTOS: El dinero va al banco
                        if (change > 0) this.bankController.receiveFromBank(player, change);
                    }
                    
                    this.updatePlayerWalletUI(player);
                    this.closePaymentModal();
                }
            }
        });

        const minimizeBtn = document.getElementById('payment-minimize-btn');
        const modal = document.getElementById('payment-modal');
        if (minimizeBtn && modal) {
            minimizeBtn.addEventListener('pointerdown', (e) => { e.preventDefault(); modal.classList.add('minimized'); });
            window.addEventListener('pointerup', (e) => { e.preventDefault(); modal.classList.remove('minimized'); });
        }

        const skipBtn = document.getElementById('btn-skip-manage');
        if(skipBtn) {
            skipBtn.addEventListener('click', () => {
                this.closePaymentModal();
                this.nextTurn();
            });
        }

        const buyHouseBtn = document.getElementById('btn-buy-house');
        if(buyHouseBtn) {
            buyHouseBtn.addEventListener('click', () => {
                const player = this.gameState.players[this.gameState.currentPlayerIndex];
                if(this.bankController.buyHouse(player, this.currentPayment.space)) {
                    this.updatePlayerWalletUI(player);
                    this.openPaymentModal(this.currentPayment.space, 0, 'manage'); // Refresh modal
                }
            });
        }
    }

    checkMonopoly(player, color) {
        if (!color) return false;
        const myColorCount = player.properties.filter(p => p.color === color).length;
        const totalColorCount = this.gameState.properties.filter(p => p.color === color).length;
        return myColorCount === totalColorCount;
    }

    openPaymentModal(spaceData, amount, type, owner = null) {
        this.currentPayment = { active: true, due: amount, paid: 0, type: type, space: spaceData, owner: owner };
        
        const titleEl = document.getElementById('payment-title');
        const reasonEl = document.getElementById('payment-reason');
        const cancelBtn = document.getElementById('btn-cancel-buy');
        
        const dropzone = document.getElementById('payment-dropzone');
        const houseActions = document.getElementById('house-actions');
        const skipBtn = document.getElementById('btn-skip-manage');

        if (cancelBtn) cancelBtn.classList.add('hidden');
        if (dropzone) dropzone.classList.remove('hidden');
        if (houseActions) houseActions.classList.add('hidden');
        if (skipBtn) skipBtn.classList.add('hidden');
        
        if (type === 'tax') {
            titleEl.innerText = "Pago de Impuestos";
            reasonEl.innerText = `Debes pagar al banco por ${spaceData.name}`;
        } else if (type === 'rent') {
            titleEl.innerText = "¡A Pagar Alquiler!";
            reasonEl.innerText = `Esta casilla es de ${owner.name}. Tienes que pagar.`;
        } else if (type === 'buy') {
            titleEl.innerText = "¿Comprar Propiedad?";
            reasonEl.innerText = `Casilla libre: ${spaceData.name}. ¿La compras?`;
            if (cancelBtn) cancelBtn.classList.remove('hidden'); 
        } else if (type === 'manage') {
            titleEl.innerText = "Gestionar Propiedad";
            reasonEl.innerText = `Has caído en tu propiedad: ${spaceData.name}.`;
            if (dropzone) dropzone.classList.add('hidden');
            if (houseActions) houseActions.classList.remove('hidden');
            if (skipBtn) skipBtn.classList.remove('hidden');
            
            const costVal = document.getElementById('house-cost-val');
            if(costVal) costVal.innerText = `$${spaceData.houseCost}`;
        }

        const cardUi = document.getElementById('property-card-ui');
        const cardColor = document.getElementById('property-card-color');
        const cardName = document.getElementById('property-card-name');
        const cardIcon = document.getElementById('property-card-icon');
        const cardPrice = document.getElementById('property-card-price');
        const rentTable = document.getElementById('property-card-rent-table');

        if (cardUi) {
            cardUi.classList.remove('hidden');
            cardName.innerText = spaceData.name;
            cardPrice.innerText = `$${spaceData.price || amount}`;

            cardName.style.color = "#222";
            cardName.style.textShadow = "2px 2px 0 rgba(255,255,255,0.8)";

            if (spaceData.color) {
                cardColor.style.backgroundColor = spaceData.color;
                cardIcon.innerText = "🏠";
            } else if (spaceData.type === 'station') {
                cardColor.style.backgroundColor = "#222";
                cardName.style.color = "#fff";
                cardName.style.textShadow = "none";
                cardIcon.innerText = "🚉";
            } else {
                cardColor.style.backgroundColor = "#bdc3c7";
                cardIcon.innerText = type === 'tax' ? "💍" : "🏢";
            }

            // --- Tabla de alquileres ---
            if (rentTable) {
                rentTable.innerHTML = '';

                if (spaceData.rent && spaceData.rent.length) {
                    const rentLabels = spaceData.type === 'station'
                        ? ['× 1 Estación', '× 2 Estaciones', '× 3 Estaciones', '× 4 Estaciones']
                        : ['Alquiler', '🏠 × 1', '🏠 × 2', '🏠 × 3', '🏠 × 4', '🏨 Hotel'];

                    spaceData.rent.forEach((val, i) => {
                        // Calcula si esta es la fila activa (el alquiler que hay que pagar)
                        const isActive = (type === 'rent' && val === amount);
                        const row = document.createElement('div');
                        row.className = 'rent-row' + (isActive ? ' rent-highlight' : '');
                        row.innerHTML = `
                            <span class="rent-label">${rentLabels[i] || `Nivel ${i}`}</span>
                            <span class="rent-value">$${val}${isActive ? ' ◀' : ''}</span>
                        `;
                        rentTable.appendChild(row);
                    });
                } else if (type === 'tax') {
                    const row = document.createElement('div');
                    row.className = 'rent-row';
                    row.innerHTML = `<span class="rent-label">Impuesto</span><span class="rent-value">$${amount}</span>`;
                    rentTable.appendChild(row);
                }
            }
        }

        document.getElementById('payment-due').innerText = `$${amount}`;
        document.getElementById('payment-paid').innerText = `$0`;
        document.getElementById('payment-modal').classList.remove('hidden', 'minimized');
    }

    closePaymentModal() {
        const prevType = this.currentPayment.type;
        this.currentPayment = { active: false, due: 0, paid: 0, type: null, space: null, owner: null };
        document.getElementById('payment-modal').classList.add('hidden');
        
        // Si no era un menú de gestión manual (donde el usuario elige cuándo terminar), pasamos turno
        if (prevType !== 'manage') {
            this.nextTurn();
        }
    }
    async handlePlayerMove(spaces) {
        const rollBtn = document.getElementById('roll-button');
        if(rollBtn) rollBtn.disabled = true;

        const player = this.gameState.players[this.gameState.currentPlayerIndex];
        await this.tokenController.moveTokenAnimated(player.id, spaces);
        
        const token = this.tokenController.tokens.find(t => t.id === player.id);

        if (player.position + spaces >= 40) {
            this.bankController.passGo(player);
        }
        player.position = token.targetPosition;
        
        const spaceData = this.gameState.properties.find(p => p.id === player.position);
        
        if (spaceData) {
            if (spaceData.type === 'tax') {
                this.openPaymentModal(spaceData, spaceData.price || 200, 'tax');
                return;
            } 
            
            if (spaceData.price) {
                if (spaceData.owner) {
                    if (spaceData.owner.id === player.id) {
                        const monopoly = this.checkMonopoly(player, spaceData.color);
                        if (monopoly && spaceData.type === 'street' && (spaceData.houses || 0) < 5) {
                            this.openPaymentModal(spaceData, 0, 'manage');
                        } else {
                            this.showNextTurnOption();
                        }
                        return;
                    } else {
                        const rentAmount = this.bankController.calculateRent(spaceData, spaceData.owner.properties, this.gameState.properties);
                        this.openPaymentModal(spaceData, rentAmount, 'rent', spaceData.owner);
                        return;
                    }
                } else {
                    this.openPaymentModal(spaceData, spaceData.price, 'buy');
                    return; 
                }
            } else if (spaceData.type === 'chance' || spaceData.type === 'chest') {
                await this.handleCardSpace(spaceData.type);
                return;
            } else if (spaceData.type === 'go-to-jail') {
                player.position = 10;
                player.jailed = true;
                this.tokenController.updateToken3DPosition(this.tokenController.tokens.find(t => t.id === player.id));
                this.showNextTurnOption();
                return;
            }
        }
        
        this.updatePlayerWalletUI(player);
        if(!this.currentPayment.active) {
            this.showNextTurnOption();
        }
    }

    showNextTurnOption() {
        const skipBtn = document.getElementById('btn-skip-manage');
        const modal = document.getElementById('payment-modal');
        const titleEl = document.getElementById('payment-title');
        const reasonEl = document.getElementById('payment-reason');
        const cardUi = document.getElementById('property-card-ui');
        const dropzone = document.getElementById('payment-dropzone');
        const houseActions = document.getElementById('house-actions');

        titleEl.innerText = "Fin de Movimiento";
        reasonEl.innerText = "Has terminado de moverte. ¿Quieres hacer algo más?";
        
        if (cardUi) cardUi.classList.add('hidden');
        if (dropzone) dropzone.classList.add('hidden');
        if (skipBtn) skipBtn.classList.remove('hidden');
        if (houseActions) houseActions.classList.add('hidden');

        modal.classList.remove('hidden');
    }

    nextTurn() {
        this.gameState.currentPlayerIndex = (this.gameState.currentPlayerIndex + 1) % this.gameState.players.length;
        const nextPlayer = this.gameState.players[this.gameState.currentPlayerIndex];
        
        console.log(`--- Turno de ${nextPlayer.name} ---`);
        this.updatePlayerWalletUI(nextPlayer);
        this.updatePlayerInventoryUI(nextPlayer);
        this.updateTurnUI();

        const rollBtn = document.getElementById('roll-button');
        if (rollBtn) rollBtn.disabled = false;
    }

    updateTurnUI() {
        const player = this.gameState.players[this.gameState.currentPlayerIndex];
        const banner = document.getElementById('turn-banner');
        const nameSpan = document.getElementById('current-player-name');
        
        if (nameSpan) nameSpan.innerText = player.name;
        if (banner) {
            banner.style.borderBottomColor = player.color;
        }
    }

    async loadProperties() {
        try {
            const response = await fetch('./js/database/properties.json');
            this.gameState.properties = await response.json();
            console.log('Properties successfully loaded:', this.gameState.properties);
        } catch (error) {
            console.error('Error loading game properties:', error);
        }
    }

    async loadCards() {
        try {
            const resp = await fetch('./js/database/cards.json');
            this.cards = await resp.json();
            this.setupCardUI();
        } catch (err) {
            console.error('Error loading cards:', err);
        }
    }

    setupCardUI() {
        const btnAccept = document.getElementById('btn-card-accept');
        if (btnAccept) {
            btnAccept.onclick = () => {
                document.getElementById('card-modal').classList.add('hidden');
                if (this.currentCard) {
                    this.executeCardAction(this.currentCard);
                    this.currentCard = null;
                }
            };
        }
    }

    async handleCardSpace(type) {
        const cardList = type === 'chance' ? this.cards.luck : this.cards.community;
        const randomCard = cardList[Math.floor(Math.random() * cardList.length)];
        this.currentCard = randomCard;

        const modal = document.getElementById('card-modal');
        const header = document.getElementById('card-type-header');
        const title = document.getElementById('card-type-title');
        const text = document.getElementById('card-text');
        const icon = document.getElementById('card-icon');

        if (type === 'chance') {
            header.className = 'card-type-luck';
            title.innerText = 'SUERTE';
            icon.innerText = '❓';
        } else {
            header.className = 'card-type-community';
            title.innerText = 'CAJA DE COMUNIDAD';
            icon.innerText = '🎁';
        }

        text.innerText = randomCard.text;
        modal.classList.remove('hidden');
    }

    async executeCardAction(card) {
        const player = this.gameState.players[this.gameState.currentPlayerIndex];
        
        switch (card.action) {
            case 'move':
                const steps = (card.target - player.position + 40) % 40;
                await this.handlePlayerMove(steps);
                return; 
            case 'move_relative':
                await this.handlePlayerMove(card.steps);
                return;
            case 'move_nearest':
                let nearest = -1;
                const stations = [5, 15, 25, 35];
                for (let s of stations) {
                    if (s > player.position) {
                        nearest = s;
                        break;
                    }
                }
                if (nearest === -1) nearest = 5;
                const dist = (nearest - player.position + 40) % 40;
                await this.handlePlayerMove(dist);
                return;
            case 'receive':
                this.bankController.receiveFromBank(player, card.amount);
                break;
            case 'pay':
                this.bankController.payBank(player, card.amount);
                break;
            case 'jail':
                player.position = 10;
                player.jailed = true;
                this.tokenController.updateToken3DPosition(this.tokenController.tokens.find(t => t.id === player.id));
                break;
            case 'receive_each':
                this.gameState.players.forEach(p => {
                    if (p.id !== player.id) {
                        this.bankController.payPlayer(p, player, card.amount);
                    }
                });
                break;
            case 'pay_each':
                this.gameState.players.forEach(p => {
                    if (p.id !== player.id) {
                        this.bankController.payPlayer(player, p, card.amount);
                    }
                });
                break;
            case 'repairs':
                let totalRepairs = 0;
                player.properties.forEach(prop => {
                    if (prop.houses) {
                        if (prop.houses === 5) totalRepairs += card.hotel;
                        else totalRepairs += prop.houses * card.house;
                    }
                });
                this.bankController.payBank(player, totalRepairs);
                break;
        }

        this.updatePlayerWalletUI(player);
        this.showNextTurnOption();
    }

    startGameLoop() {}
}