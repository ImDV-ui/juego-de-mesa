import DiceController from './DiceController.js';
import DragController from './DragController.js';
import TokenController from './TokenController.js';
import BoardController from './BoardController.js';

export default class GameController {
    constructor() {
        this.gameState = {
            players: [],
            currentPlayerIndex: 0,
            properties: [],
            isGameOver: false
        };

        // Initialize sub-controllers
        this.boardController = new BoardController();
        this.diceController = new DiceController();
        this.dragController = new DragController();
        this.tokenController = new TokenController();
    }

    async init() {
        console.log('GameController initializing...');
        await this.loadProperties();
        
        // Initialize global 3D environment first
        await this.boardController.init();
        
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

    startGameLoop() {
        console.log('Starting game loop...');
        // Future initialization of turn management
    }
}
