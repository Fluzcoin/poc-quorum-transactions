# Installation
Run ```npm install```

# Measure TPS
Run ```node measure_tps --provider={provider url} --startBlock={from which block to count TXs} --endBlock={to which block to count TXs (if left empty uses 'latest' block)} --transactionLog={path to transaction logfile} --protocol={http|websocket|ipc}```