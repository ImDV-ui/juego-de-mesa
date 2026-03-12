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
        this.currentPayment = { active: false, due: 0, paid: 0 };

        // Initialize sub-controllers
        this.boardController = new BoardController();
        this.diceController = new DiceController();
        this.dragController = new DragController();
        this.tokenController = new TokenController();
        this.bankController = new BankController();
    }

    async init() {
        console.log('GameController initializing...');
        await this.loadProperties();
        
        // Setup Players & Bank
        const player1 = new Player(1, "Jugador 1", "#ff4757");
        this.gameState.players.push(player1);
        
        // Give initial $1500 breakdown
        this.bankController.distributeInitialMoney(player1);
        this.updatePlayerWalletUI(player1);
        
        // Initialize global 3D environment first
        await this.boardController.init();
        
        // Setup manual payment drag and drop
        this.setupPaymentUI();
        
        // Pass shared resources down
        this.diceController.setupGlobalContext(
            this.boardController.scene, 
            this.boardController.world, 
            this.boardController.floorPhysicsMaterial
        );

        // Initialize modules
        await this.diceController.init();
        this.dragController.init();
        
        // Pass scene and coordinates to tokens
        this.tokenController.setupGlobalContext(
            this.boardController.scene,
            this.boardController.spaceCoordinates
        );
        this.tokenController.init();
        
        // Spawn the player's car token (player 1)
        await this.tokenController.createPlayerToken(1, './assets/fichas/monopoly_car.glb');

        // Hook into dice roll complete event
        this.diceController.onRollComplete = async (results, total) => {
            console.log(`Rolled a ${total}! Starting movement...`);
            await this.handlePlayerMove(total);
        };

        // Setup wallet hide/show toggle
        const toggleWalletBtn = document.getElementById('toggle-wallet-btn');
        if (toggleWalletBtn) {
            toggleWalletBtn.addEventListener('click', () => {
                const wallet = document.getElementById('player-wallet');
                wallet.classList.toggle('collapsed');
                if (wallet.classList.contains('collapsed')) {
                    toggleWalletBtn.innerText = '➡ Mostrar';
                } else {
                    toggleWalletBtn.innerText = '⬅ Ocultar';
                }
            });
        }

        // Expose to window for manual testing in console
        window.gameController = this;

        this.startGameLoop();
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
                if (e.target.getAttribute('draggable') === 'false') {
                    e.preventDefault();
                    return;
                }
                const denom = e.target.getAttribute('data-denomination');
                e.dataTransfer.setData('text/plain', denom);
                e.dataTransfer.effectAllowed = 'move';
            });
        });

        const dropzone = document.getElementById('payment-dropzone');
        if (!dropzone) return;

        dropzone.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            dropzone.classList.add('dragover');
        });

        dropzone.addEventListener('dragleave', () => {
            dropzone.classList.remove('dragover');
        });

        dropzone.addEventListener('drop', (e) => {
            e.preventDefault();
            dropzone.classList.remove('dragover');
            
            const denomStr = e.dataTransfer.getData('text/plain');
            if (!denomStr) return;
            const denom = parseInt(denomStr, 10);

            const player = this.gameState.players[0]; // Active player
            
            if (this.currentPayment.active && player.wallet[denom] > 0) {
                // Deduct manually from physical hand
                player.wallet[denom] -= 1;
                this.currentPayment.paid += denom;
                
                // Update UI state
                this.updatePlayerWalletUI(player);
                document.getElementById('payment-paid').innerText = `$${this.currentPayment.paid}`;
                
                // Evaluate completion
                if (this.currentPayment.paid >= this.currentPayment.due) {
                    const change = this.currentPayment.paid - this.currentPayment.due;
                    if (change > 0) {
                        this.bankController.receiveFromBank(player, change);
                        console.log(`Pago completado. Cambio devuelto al jugador: $${change}`);
                    } else {
                        console.log("Pago completado exacto.");
                    }
                    
                    this.updatePlayerWalletUI(player);
                    this.closePaymentModal();
                }
            }
        });

        // Toggle Minimize / Expand (Hold to view board)
        const minimizeBtn = document.getElementById('payment-minimize-btn');
        const modal = document.getElementById('payment-modal');
        
        if (minimizeBtn && modal) {
            const hideModal = (e) => {
                e.preventDefault();
                modal.classList.add('minimized');
            };
            
            const showModal = (e) => {
                e.preventDefault();
                modal.classList.remove('minimized');
            };

            // Touch & Mouse universally via Pointer Events
            minimizeBtn.addEventListener('pointerdown', hideModal);
            
            // Release anywhere (even off the button) restores the view
            window.addEventListener('pointerup', showModal);
        }
    }

    openPaymentModal(spaceData, amount) {
        this.currentPayment = { active: true, due: amount, paid: 0 };
        
        const isTax = spaceData.name.toLowerCase().includes('impuesto');
        const titleEl = document.getElementById('payment-title');
        const reasonEl = document.getElementById('payment-reason');
        
        if (isTax) {
            if(titleEl) titleEl.innerText = "Pago Requerido";
            if(reasonEl) reasonEl.innerText = `Debes pagar tributos por ${spaceData.name}`;
        } else {
            if(titleEl) titleEl.innerText = "¿Quieres comprar esta propiedad?";
            if(reasonEl) reasonEl.innerText = `Has caído en ${spaceData.name}`;
        }

        // Configure Property Card UI
        const cardUi = document.getElementById('property-card-ui');
        const cardColor = document.getElementById('property-card-color');
        const cardName = document.getElementById('property-card-name');
        const cardIcon = document.getElementById('property-card-icon');
        const cardPrice = document.getElementById('property-card-price');

        if (cardUi && cardColor && cardName && cardIcon && cardPrice) {
            cardUi.classList.remove('hidden');
            cardName.innerText = spaceData.name;
            cardPrice.innerText = spaceData.price ? spaceData.price : `M${amount}`;
            
            // Revert style overrides from other cards
            cardName.style.color = "#222";
            cardName.style.textShadow = "2px 2px 0 rgba(255,255,255,0.8)";

            if (spaceData.color) {
                // Street property
                cardColor.style.backgroundColor = spaceData.color;
                cardIcon.innerText = "🏠";
            } else if (spaceData.name.toLowerCase().includes("estación") || spaceData.name.toLowerCase().includes("helipuerto") || spaceData.name.toLowerCase().includes("puerto") || spaceData.name.toLowerCase().includes("est.")) {
                // Station/Transport property
                cardColor.style.backgroundColor = "#222";
                cardName.style.color = "#fff";
                cardName.style.textShadow = "none";
                cardIcon.innerText = "🚉";
            } else if (isTax) {
                // Tax space
                cardColor.style.backgroundColor = "#e74c3c"; // Reddish warning color
                cardIcon.innerText = "💍";
            } else {
                // Utilities or other
                cardColor.style.backgroundColor = "#bdc3c7";
                cardIcon.innerText = "🏢";
            }
        }

        document.getElementById('payment-due').innerText = `$${amount}`;
        document.getElementById('payment-paid').innerText = `$0`;
        
        // Ensure it starts maximized
        const modal = document.getElementById('payment-modal');
        modal.classList.remove('hidden', 'minimized');
    }

    closePaymentModal() {
        this.currentPayment = { active: false, due: 0, paid: 0 };
        document.getElementById('payment-modal').classList.add('hidden');
        
        // Re-enable dice locally
        const rollBtn = document.getElementById('roll-button');
        if (rollBtn) rollBtn.disabled = false;
    }

    async handlePlayerMove(spaces) {
        console.log(`Player moving ${spaces} spaces!`);
        
        const rollBtn = document.getElementById('roll-button');
        if(rollBtn) rollBtn.disabled = true;

        await this.tokenController.moveTokenAnimated(1, spaces);
        
        const token = this.tokenController.tokens.find(t => t.id === 1);
        const player = this.gameState.players[0];

        // Did we pass GO? 
        if (player.position + spaces >= 40) {
            console.log("¡Has pasado por la Salida! Recibes $200 automático.");
            this.bankController.passGo(player);
        }
        
        // Update model position
        player.position = token.targetPosition;
        
        // Automated Land/Pay evaluation
        const spaceData = this.boardController.monopolyData[player.position];
        console.log(`Landed on: ${spaceData.name}`);

        if (spaceData && spaceData.price) {
            // Extract the numerical value from strings like "M60" or "Paga M200"
            const amount = parseInt(spaceData.price.replace(/\D/g, ''), 10);
            
            if (!isNaN(amount) && amount > 0) {
                // Update HUD BEFORE modal shows
                this.updatePlayerWalletUI(player);

                console.log(`Iniciando pago manual para: $${amount}...`);
                this.openPaymentModal(spaceData, amount);
                return; // Early return, modal closure will re-enable the dice
            }
        }
        
        // Update the HUD
        this.updatePlayerWalletUI(player);

        if(rollBtn) rollBtn.disabled = false;
        // Logic for TurnController & updating Player model properties will continue here.
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

    startGameLoop() {
        console.log('Starting game loop...');
        // Future initialization of turn management
    }
}
