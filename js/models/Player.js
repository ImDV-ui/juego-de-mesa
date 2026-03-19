export default class Player {
    constructor(id, name, color) {
        this.id = id;
        this.name = name;
        this.color = color;
        this.position = 0;
        
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

    getTotalMoney() {
        let total = 0;
        for (const [denomination, count] of Object.entries(this.wallet)) {
            total += parseInt(denomination) * count;
        }
        return total;
    }

    addBill(denomination, count = 1) {
        if (this.wallet[denomination] !== undefined) {
            this.wallet[denomination] += count;
        }
    }

    removeBill(denomination, count = 1) {
        if (this.wallet[denomination] !== undefined && this.wallet[denomination] >= count) {
            this.wallet[denomination] -= count;
            return true;
        }
        return false;
    }
}
