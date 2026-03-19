export default class DragController {
    constructor() {
        this.activeElement = null;
        this.offsetX = 0;
        this.offsetY = 0;
        this.initialZIndex = '';

        this.onPointerDown = this.onPointerDown.bind(this);
        this.onPointerMove = this.onPointerMove.bind(this);
        this.onPointerUp = this.onPointerUp.bind(this);
    }

    init() {
        document.addEventListener('pointerdown', this.onPointerDown);
        document.addEventListener('pointermove', this.onPointerMove);
        document.addEventListener('pointerup', this.onPointerUp);
        document.addEventListener('pointercancel', this.onPointerUp);

        document.addEventListener('dragstart', (e) => {
            if (e.target.classList && e.target.classList.contains('draggable')) {
                e.preventDefault();
            }
        });
    }

    onPointerDown(e) {
        if (e.target.classList && e.target.classList.contains('draggable')) {
            this.activeElement = e.target;
            this.activeElement.setPointerCapture(e.pointerId);

            const rect = this.activeElement.getBoundingClientRect();

            this.offsetX = e.clientX - rect.left;
            this.offsetY = e.clientY - rect.top;

            this.initialZIndex = this.activeElement.style.zIndex;
            this.activeElement.style.zIndex = 1000;
            this.activeElement.classList.add('dragging');

            this.offsetX = e.clientX - (rect.left + rect.width / 2);
            this.offsetY = e.clientY - (rect.top + rect.height / 2);
        }
    }

    onPointerMove(e) {
        if (!this.activeElement) return;

        const board = document.getElementById('board');
        const boardRect = board.getBoundingClientRect();

        let newX = e.clientX - boardRect.left - this.offsetX;
        let newY = e.clientY - boardRect.top - this.offsetY;

        newX = Math.max(0, Math.min(newX, boardRect.width));
        newY = Math.max(0, Math.min(newY, boardRect.height));

        this.activeElement.style.left = `${newX}px`;
        this.activeElement.style.top = `${newY}px`;
    }

    onPointerUp(e) {
        if (!this.activeElement) return;

        this.activeElement.releasePointerCapture(e.pointerId);
        this.activeElement.style.zIndex = this.initialZIndex;
        this.activeElement.classList.remove('dragging');

        const targetElement = document.elementFromPoint(e.clientX, e.clientY);
        const space = targetElement ? targetElement.closest('.space') : null;

        const tokenId = this.activeElement.id;

        this.activeElement = null;
    }
}

