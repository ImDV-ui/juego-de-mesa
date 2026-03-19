export default class BankController {
    constructor() {
        this.denominations = [500, 100, 50, 20, 10, 5, 1];
        
        this.initialDistribution = {
            '500': 2,
            '100': 2,
            '50':  2,
            '20':  6,
            '10':  5,
            '5':   5,
            '1':   5 
        };
    }

    distributeInitialMoney(player) {
        for (const [denom, count] of Object.entries(this.initialDistribution)) {
            player.wallet[denom] += count;
        }
    }

    payBank(player, amount) {
        if (player.getTotalMoney() < amount) {
            return false;
        }

        this.processPayment(player, amount);
        return true;
    }

    receiveFromBank(player, amount) {
        let remaining = amount;
        
        for (const denom of this.denominations) {
            const count = Math.floor(remaining / denom);
            if (count > 0) {
                player.wallet[denom] += count;
                remaining -= (count * denom);
            }
        }
    }

    payPlayer(payer, payee, amount) {
        if (payer.getTotalMoney() < amount) {
            return false;
        }

        this.processPayment(payer, amount);
        this.receiveFromBank(payee, amount); 
        return true;
    }

    processPayment(player, amount) {
        let remainingToPay = amount;

        for (let i = this.denominations.length - 1; i >= 0; i--) {
            const denom = this.denominations[i];
            
            while (remainingToPay >= denom && player.wallet[denom] > 0) {
                player.wallet[denom] -= 1;
                remainingToPay -= denom;
            }
        }

        if (remainingToPay === 0) return;

        for (let i = this.denominations.length - 1; i >= 0; i--) {
            const denom = this.denominations[i];
            if (denom > remainingToPay && player.wallet[denom] > 0) {
                player.wallet[denom] -= 1;
                const changeToReturn = denom - remainingToPay;
                
                this.receiveFromBank(player, changeToReturn);
                foundBillToBreak = true;
                break;
            }
        }
    }

    passGo(player) {
        this.receiveFromBank(player, 200);
    }

    calculateRent(property, ownerProperties, allBoardData) {
        if (!property.rent || !property.rent.length) return 0;

        let rentLevel = 0; 
        

        if (property.type === 'street') {
            if (property.houses > 0) {
                rentLevel = property.houses;
            }
        } else if (property.type === 'station') {
            const ownedStations = ownerProperties.filter(p => p.type === 'station').length;
            rentLevel = Math.min(ownedStations - 1, 3);
        }

        let rent = property.rent[rentLevel];

        if (property.type === 'street' && property.houses === 0) {
            const myColorCount = ownerProperties.filter(p => p.color === property.color).length;
            const totalColorCount = allBoardData.filter(p => p.color === property.color).length;
            if (myColorCount === totalColorCount && totalColorCount > 0) {
                rent *= 2;
            }
        }

        return rent;
    }

    buyHouse(player, property) {
        const cost = property.houseCost;
        if (player.getTotalMoney() < cost) return false;
        
        if (this.payBank(player, cost)) {
            property.houses = (property.houses || 0) + 1;
            return true;
        }
        return false;
    }
}

