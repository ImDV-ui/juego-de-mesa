import GameController from './controllers/GameController.js';

document.addEventListener('DOMContentLoaded', () => {
    console.log('Main application starting...');
    const gameController = new GameController();
    gameController.init();
});

