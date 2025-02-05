function createRecentlyUsedAccounts(limit = 3) {
    const history = [];

    function addBatch(accounts) {
        history.push(accounts);
        if (history.length > limit) {
            history.shift(); // Remove the oldest batch
        }
    }

    function isRecentlyUsed(account) {
        return history.some(batch => batch.includes(account));
    }

    return {
        addBatch,
        isRecentlyUsed
    };
}

export default createRecentlyUsedAccounts;
