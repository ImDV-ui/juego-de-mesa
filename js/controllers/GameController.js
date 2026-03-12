import DiceController from './DiceController.js';
import DragController from './DragController.js';
import TokenController from './TokenController.js';

export default class GameController {
    constructor() {
        this.gameState = {
            players: [],
            currentPlayerIndex: 0,
            properties: [],
            isGameOver: false
        };

        // Initialize sub-controllers
        this.diceController = new DiceController();
        this.dragController = new DragController();
        this.tokenController = new TokenController();
    }

    async init() {
        console.log('GameController initializing...');
        await this.loadProperties();
        this.setupBoard();

        // Initialize modules
        await this.diceController.init();
        this.dragController.init();
        this.tokenController.init();
        
        // Spawn the player's car token (player 1)
        await this.tokenController.createPlayerToken(1, './assets/fichas/monopoly_car.glb');

        // Hook into dice roll complete event
        this.diceController.onRollComplete = async (results, total) => {
            console.log(`Rolled a ${total}! Starting movement...`);
            await this.handlePlayerMove(total);
        };

        this.startGameLoop();
    }

    async handlePlayerMove(spaces) {
        console.log(`Player moving ${spaces} spaces!`);
        
        const rollBtn = document.getElementById('roll-button');
        if(rollBtn) rollBtn.disabled = true;

        await this.tokenController.moveTokenAnimated(1, spaces);
        
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

    setupBoard() {
        console.log('Setting up board...');
        // Future logic to generate board spaces and inject them into the DOM
    }

    startGameLoop() {
        console.log('Starting game loop...');
        // Future initialization of turn management
    }
}
