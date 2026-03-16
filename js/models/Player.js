export default class Player {
    constructor(id, name, color) {
        this.id = id;
        this.name = name;
        this.color = color;
        this.position = 0; // Empieza en la Salida (índice 0)
        
        // Classic Monopoly breakdown: $1,500
        // Rastreo físico de la billetera
        this.wallet = {
            '500': 0,
            '100': 0,
            '50': 0,
            '20': 0,
            '10': 0,
            '5': 0,
            '1': 0
        };

        // Inventario de propiedades compradas
        this.properties = []; 
        
        this.jailed = false;
        this.jailTurns = 0;
    }

    /**
     * Calcula el dinero total que tiene el jugador basándose en los billetes físicos
     * @returns {number} Valor monetario total
     */
    getTotalMoney() {
        let total = 0;
        for (const [denomination, count] of Object.entries(this.wallet)) {
            total += parseInt(denomination) * count;
        }
        return total;
    }

    /**
     * Añade un billete específico a la billetera
     */
    addBill(denomination, count = 1) {
        if (this.wallet[denomination] !== undefined) {
            this.wallet[denomination] += count;
        }
    }

    /**
     * Elimina un billete específico de la billetera (si tiene suficientes)
     */
    removeBill(denomination, count = 1) {
        if (this.wallet[denomination] !== undefined && this.wallet[denomination] >= count) {
            this.wallet[denomination] -= count;
            return true;
        }
        return false;
    }
}