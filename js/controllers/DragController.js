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
        // We use Pointer Events to support both Mouse and Touch elegantly
        document.addEventListener('pointerdown', this.onPointerDown);
        document.addEventListener('pointermove', this.onPointerMove);
        document.addEventListener('pointerup', this.onPointerUp);
        document.addEventListener('pointercancel', this.onPointerUp);

        // Prevent default native HTML5 drag and drop on these elements to avoid conflicts
        document.addEventListener('dragstart', (e) => {
            if (e.target.classList && e.target.classList.contains('draggable')) {
                e.preventDefault();
            }
        });

        console.log('DragController initialized.');
    }

    onPointerDown(e) {
        if (e.target.classList && e.target.classList.contains('draggable')) {
            this.activeElement = e.target;
            this.activeElement.setPointerCapture(e.pointerId);

            const rect = this.activeElement.getBoundingClientRect();

            // Calculate cursor offset relative to the element's top/left corner
            this.offsetX = e.clientX - rect.left;
            this.offsetY = e.clientY - rect.top;

            this.initialZIndex = this.activeElement.style.zIndex;
            this.activeElement.style.zIndex = 1000;
            this.activeElement.classList.add('dragging');

            // We need to account for the translate(-50%, -50%) safely but 
            // tracking offset against bounding client rect is sufficient.
            // When translating using left/top combined with transform(-50%,-50%),
            // the CSS handle acts from the center. 
            // We adjust offsetX and Y to be relative to the element center:
            this.offsetX = e.clientX - (rect.left + rect.width / 2);
            this.offsetY = e.clientY - (rect.top + rect.height / 2);
        }
    }

    onPointerMove(e) {
        if (!this.activeElement) return;

        // We are positioning the token relative to the .board container 
        const board = document.getElementById('board');
        const boardRect = board.getBoundingClientRect();

        // Calculate new X,Y relative to the board
        let newX = e.clientX - boardRect.left - this.offsetX;
        let newY = e.clientY - boardRect.top - this.offsetY;

        // Boundary enforcement (optional, but good for UX)
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

        // Find which space the token was dropped onto (for logical linkage)
        // This will be implemented fully later in views/controllers
        const targetElement = document.elementFromPoint(e.clientX, e.clientY);
        const space = targetElement ? targetElement.closest('.space') : null;

        const tokenId = this.activeElement.id;

        if (space) {
            console.log(`Token ${tokenId} dropped onto`, space);
        } else {
            console.log(`Token ${tokenId} dropped outside logic area.`);
        }

        this.activeElement = null;
    }
}
