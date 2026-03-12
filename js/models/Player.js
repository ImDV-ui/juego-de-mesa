export default class Player {
    constructor(id, name, color) {
        this.id = id;
        this.name = name;
        this.color = color;
        this.position = 0; // Starts at GO (index 0)
        
        // Classic Monopoly breakdown: $1,500
        // Physical wallet tracking
        this.wallet = {
            '500': 0,
            '100': 0,
            '50': 0,
            '20': 0,
            '10': 0,
            '5': 0,
            '1': 0
        };

        this.properties = []; 
        this.jailed = false;
        this.jailTurns = 0;
    }

    /**
     * Calculates the total money the player has based on physical bills
     * @returns {number} Total monetary value
     */
    getTotalMoney() {
        let total = 0;
        for (const [denomination, count] of Object.entries(this.wallet)) {
            total += parseInt(denomination) * count;
        }
        return total;
    }

    /**
     * Adds a specific bill denomination to the wallet
     */
    addBill(denomination, count = 1) {
        if (this.wallet[denomination] !== undefined) {
            this.wallet[denomination] += count;
        }
    }

    /**
     * Removes a specific bill denomination from the wallet
     */
    removeBill(denomination, count = 1) {
        if (this.wallet[denomination] !== undefined && this.wallet[denomination] >= count) {
            this.wallet[denomination] -= count;
            return true;
        }
        return false;
    }
}
