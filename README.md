# Installation
Run ```npm install```

# Account generation
Run ```node generate_accounts --providers={comma list of provider urls} --count={amount of accounts to create} --protocol={http|websocket|ipc}```

# Fund accounts
Run ```node fund_accounts --fundingProvider={provider url} --fundingAccount={eth address} --protocol={http|websocket|ipc}```

# Start TX spamming
Run ```node spam_transactions --provider={provider url} --tps={transactions to send per second} --txcount={maximum transactions to send from one account} --protocol={http|websocket|ipc}```