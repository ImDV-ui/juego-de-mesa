export default class BankController {
    constructor() {
        this.denominations = [500, 100, 50, 20, 10, 5, 1];
        
        // Initial Classic Monopoly Distribution Breakdown
        this.initialDistribution = {
            '500': 2, // $1000
            '100': 2, // $200
            '50':  2, // $100
            '20':  6, // $120
            '10':  5, // $50
            '5':   5, // $25
            '1':   5  // $5
            // Total = $1500
        };
    }

    /**
     * Initializes a player with the starting physical $1,500.
     * @param {Player} player 
     */
    distributeInitialMoney(player) {
        for (const [denom, count] of Object.entries(this.initialDistribution)) {
            player.wallet[denom] += count;
        }
        console.log(`Bank distributed initial $1,500 to ${player.name}`);
    }

    /**
     * Handles paying the bank from a player. Automatically makes change if necessary.
     * @param {Player} player 
     * @param {number} amount 
     * @returns {boolean} True if successful, false if bankrupt
     */
    payBank(player, amount) {
        if (player.getTotalMoney() < amount) {
            console.log(`${player.name} cannot afford to pay $${amount} to the Bank (Bankrupt!)`);
            return false;
        }

        this.processPayment(player, amount);
        console.log(`${player.name} paid $${amount} to the Bank.`);
        return true;
    }

    /**
     * Handles a player receiving money from the bank (e.g., passing GO).
     * @param {Player} player 
     * @param {number} amount 
     */
    receiveFromBank(player, amount) {
        // Greedy algorithm to give the player the biggest physical bills possible
        let remaining = amount;
        
        for (const denom of this.denominations) {
            const count = Math.floor(remaining / denom);
            if (count > 0) {
                player.wallet[denom] += count;
                remaining -= (count * denom);
            }
        }
        console.log(`${player.name} received $${amount} from the Bank.`);
    }

    /**
     * Handles paying another player.
     */
    payPlayer(payer, payee, amount) {
        if (payer.getTotalMoney() < amount) {
            console.log(`${payer.name} cannot afford to pay $${amount} to ${payee.name} (Bankrupt!)`);
            return false;
        }

        this.processPayment(payer, amount);
        this.receiveFromBank(payee, amount); // Receiver gets it in optimal bills
        console.log(`${payer.name} paid $${amount} to ${payee.name}.`);
        return true;
    }

    /**
     * Core algorithm: Takes exactly 'amount' from player's physical wallet. 
     * If exact change isn't possible, it takes a larger bill and returns change.
     */
    processPayment(player, amount) {
        let remainingToPay = amount;

        // Try exact/greedy exact matching first (using smallest necessary bills)
        for (let i = this.denominations.length - 1; i >= 0; i--) {
            const denom = this.denominations[i];
            
            while (remainingToPay >= denom && player.wallet[denom] > 0) {
                player.wallet[denom] -= 1;
                remainingToPay -= denom;
            }
        }

        if (remainingToPay === 0) return;

        // If we still owe money (meaning we didn't have exact change, e.g., owing 15 but only having a 50)
        // Find the smallest bill we have that is LARGER than the remaining amount
        let foundBillToBreak = false;
        for (let i = this.denominations.length - 1; i >= 0; i--) {
            const denom = this.denominations[i];
            if (denom > remainingToPay && player.wallet[denom] > 0) {
                // Break this bill
                player.wallet[denom] -= 1;
                const changeToReturn = denom - remainingToPay;
                
                // Give back the change
                this.receiveFromBank(player, changeToReturn);
                foundBillToBreak = true;
                break;
            }
        }

        // Failsafe: If logic somehow misses, this shouldn't trigger assuming check prior to processPayment
        // But if a huge jump is needed (owing $1 but only having five $100s) we just deduct total logically
        // Usually breaking one bill is enough, but recursion guarantees safety.
        if (!foundBillToBreak && remainingToPay > 0) {
            console.error("Critical error in change algorithm! Fallback greedy break needed.");
        }
    }

    /**
     * Helper for passing GO
     */
    passGo(player) {
        this.receiveFromBank(player, 200);
        console.log(`${player.name} passed GO and collected $200.`);
    }

    /**
     * Helper to calculate active rent, checking if owner has the monopoly color group
     * @param {Object} property The property data
     * @param {Array} ownerProperties Array of properties owned by the player
     * @param {Array} allBoardData The global board data to check group size
     */
    calculateRent(property, ownerProperties, allBoardData) {
        if (!property.color) return 0; // Not a street
        
        // Base rent could be stored on property, assume 10% of price for stub logic
        const basePrice = parseInt(property.price.replace(/\D/g, ''));
        let rent = Math.floor(basePrice * 0.10); 

        // Check for monopoly (double rent)
        const myColorCount = ownerProperties.filter(p => p.color === property.color).length;
        const totalColorCount = allBoardData.filter(p => p.color === property.color).length;

        if (myColorCount === totalColorCount && totalColorCount > 0) {
            console.log(`Monopoly Double Rent active for ${property.name}!`);
            rent *= 2;
        }

        return rent;
    }
}
