const fs = require('fs');
const path = require('path');

// Mock database for consoles
const DB_FILE = path.join(__dirname, 'mock_consoles.json');

function loadDB() {
    if (!fs.existsSync(DB_FILE)) return {};
    return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
}

function saveDB(data) {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}

async function main() {
    const command = process.argv[2];
    const args = process.argv.slice(3);

    const db = loadDB();

    // usage: node index.js deploy <owner_address>
    if (command === 'deploy') {
        const owner = args[0];
        if (!owner) throw new Error("Owner address required");
        
        // Mock: generate a deterministic address based on owner
        const mockConsoleAddress = "0xConsole" + owner.slice(2);
        
        db[owner] = {
            address: mockConsoleAddress,
            balance: 0, // Mock USDC balance
            owner: owner
        };
        saveDB(db);
        
        console.log(JSON.stringify({
            status: "success",
            consoleAddress: mockConsoleAddress,
            txHash: "0xmocktxhash" + Math.random().toString(36).substring(7)
        }));
    } 
    // usage: node index.js topup <owner_address> <amount>
    else if (command === 'topup') {
        const owner = args[0];
        const amount = parseFloat(args[1]);
        
        if (!db[owner]) throw new Error("Console not found for owner");
        
        db[owner].balance += amount;
        saveDB(db);
        
        console.log(JSON.stringify({
            status: "success",
            newBalance: db[owner].balance
        }));
    }
    // usage: node index.js spend <owner_address> <amount>
    else if (command === 'spend') {
        const owner = args[0];
        const amount = parseFloat(args[1]);
        
        if (!db[owner]) throw new Error("Console not found for owner");
        if (db[owner].balance < amount) throw new Error("Insufficient funds");
        
        db[owner].balance -= amount;
        saveDB(db);
        
        console.log(JSON.stringify({
            status: "success",
            newBalance: db[owner].balance,
            txHash: "0xmockspendtx" + Math.random().toString(36).substring(7)
        }));
    }
    // usage: node index.js balance <owner_address>
    else if (command === 'balance') {
        const owner = args[0];
        if (!db[owner]) {
             // Return 0 if not found, or error? Let's return 0/empty
             console.log(JSON.stringify({
                status: "success",
                balance: 0,
                address: null
            }));
             return;
        }
        
        console.log(JSON.stringify({
            status: "success",
            balance: db[owner].balance,
            address: db[owner].address
        }));
    }
    else {
        console.error("Unknown command");
        process.exit(1);
    }
}

main().catch(err => {
    console.error(JSON.stringify({status: "error", message: err.message}));
    process.exit(1);
});
