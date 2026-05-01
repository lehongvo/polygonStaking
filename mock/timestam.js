/**
 * @title Storage
 * @dev Store & retrieve value in a variable
 * @custom:dev-run-script ./scripts/deploy_with_ethers.ts
 */

class Storage {
    constructor() {
        // Calculate current date in days since epoch (similar to Solidity: block.timestamp / 86400)
        this.currentDate = Math.floor(Date.now() / 1000 / 86400);
    }

    // Getter method to retrieve the current date
    getCurrentDate() {
        return this.currentDate;
    }

    // Update the current date
    updateCurrentDate() {
        this.currentDate = Math.floor(Date.now() / 1000 / 86400);
        return this.currentDate;
    }

    // Convert timestamp to days since epoch
    static timestampToDays(timestamp) {
        return Math.floor(timestamp / 86400);
    }

    // Convert days since epoch to timestamp
    static daysToTimestamp(days) {
        return days * 86400;
    }
}

// Example usage
function main() {
    const storage = new Storage();
    console.log('Current date in days since epoch:', storage.getCurrentDate());
    
    // Get current timestamp
    const currentTimestamp = Math.floor(Date.now() / 1000);
    console.log('Current timestamp:', currentTimestamp);
    
    // Convert timestamp to days
    const daysFromTimestamp = Storage.timestampToDays(currentTimestamp);
    console.log('Days from timestamp:', daysFromTimestamp);
    
    // Convert days back to timestamp
    const timestampFromDays = Storage.daysToTimestamp(daysFromTimestamp);
    console.log('Timestamp from days:', timestampFromDays);
}

// Export for use in other modules
module.exports = Storage;

// Run if this file is executed directly
if (require.main === module) {
    main();
}

