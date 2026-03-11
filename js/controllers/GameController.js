import DiceController from './DiceController.js';
import DragController from './DragController.js';

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
    }

    async init() {
        console.log('GameController initializing...');
        await this.loadProperties();
        this.setupBoard();

        // Initialize modules
        await this.diceController.init();
        this.dragController.init();

        // Hook into dice roll complete event for turn logic later
        this.diceController.onRollComplete = (results, total) => {
            console.log(`Rolled a ${total}! Logic payload goes here.`);
            this.handlePlayerMove(total);
        };

        this.startGameLoop();
    }

    handlePlayerMove(spaces) {
        console.log(`Player needs to move ${spaces} spaces! (Logic to be implemented)`);
        // Logic for TurnController & updating Player model will go here.
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
