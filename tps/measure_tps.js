let Web3 = require('web3');
let web3 = new Web3();
let glob = require("glob");
let LineByLineReader = require('line-by-line');
let ProgressBar = require('progress');
let bigInt = require("big-integer");
let RateLimiter = require('limiter').RateLimiter;

/**
 * Handle arguments
 */
let minimist = require('minimist');
let args = minimist(process.argv.slice(2), {
    string: ['provider', 'startBlock', 'endBlock', 'transactionLog', 'protocol'],

    unknown: function () {
        console.log('Invalid arguments');
        process.exit();
    }
});


if (args.protocol === 'websocket') {
    web3.setProvider(new web3.providers.WebsocketProvider(args.provider));
} else if (args.protocol === 'ipc') {
    let net = require('net');
    web3.setProvider(new web3.providers.IpcProvider(args.provider, net));
} else {
    web3.setProvider(new web3.providers.HttpProvider(args.provider));
}

let startBlock;
let endBlock;

let startBlockTime;
let endBlockTime;

let blockProgressBar;

let timeReferenceBlock;
let timeReferenceBlockTs;

web3.eth.getBlock('latest', function (e, res) {
    startBlock = !args.startBlock ? 0 : args.startBlock;
    endBlock = !args.endBlock ? res.number : args.endBlock;

    console.log("Measuring TPS of the block range: " + startBlock + " - " + endBlock);

    // Save starting block time (microseconds)
    web3.eth.getBlock(startBlock, function (err, result) {
        startBlockTime = result.timestamp;
        timeReferenceBlock = startBlock;
        timeReferenceBlockTs = startBlockTime;
    });

    // Save ending block time, go through all blocks to save transaction count
    web3.eth.getBlock(endBlock, function (err, result) {
        endBlockTime = result.timestamp;

        blockProgressBar = new ProgressBar('Processing blocks :current/:total [:bar] | :rate/s | :percent | ETA: :etas', {total: parseInt(endBlock), curr: parseInt(startBlock) - 1});
        getBlockData(startBlock, endBlock);
    });
});


let txcount = 0;
let txcountInterval = 0;
let blockIntervalMaxTps = 0;
let blockIntervalMinTps = -1;
let blockWithMaxTps, blockWithMinTps;

/**
 * Iteratively go over all blocks and count total TX's
 *
 * @param num
 * @param endBlock
 */
function getBlockData(num, endBlock) {
    web3.eth.getBlock(num, function (err, result) {
        if (err) {
            console.log(err);
        }

        blockProgressBar.tick();

        txcount = txcount + result.transactions.length;
        txcountInterval = txcountInterval + result.transactions.length;

        if ((result.timestamp - timeReferenceBlockTs) / 1e9 >= 1) {
            if (txcountInterval > blockIntervalMaxTps) {
                blockIntervalMaxTps = txcountInterval;
                blockWithMaxTps = num;
            }

            if (blockIntervalMinTps === -1 || txcountInterval < blockIntervalMinTps) {
                blockIntervalMinTps = txcountInterval;
                blockWithMinTps = num;
            }

            txcountInterval = 0;
            timeReferenceBlock = num;
            timeReferenceBlockTs = result.timestamp;
        }


        if (num == endBlock) {
            let durationSec = (endBlockTime - startBlockTime) / 1e9;

            console.log("Transactions recorded:", txcount);
            console.log("First block time:", startBlockTime, "| Latest block time:", endBlockTime, "| Total creation duration (sec):", durationSec);
            console.log("Max TPS:", blockIntervalMaxTps, "at block", blockWithMaxTps, "| Min TPS:", blockIntervalMinTps, "at block", blockWithMinTps);
            console.log("AVG TPS:", txcount / durationSec, "\n");

            analyzeAdditionalData();
        } else {
            num++;
            getBlockData(num, endBlock)
        }
    });
}

let totalTxs = 0;
let failedTxs = 0;
let maxDelay = 0;
let avgDelay = 0;
let firstTx, lastTx;
let minDelay = -1;
let oldestTxSendTime = bigInt(-1);
let latestTxSendTime = bigInt(-1);

/**
 * Analyze additional transactional data from the provided logfile
 *
 * @returns {Promise.<void>}
 */
function analyzeAdditionalData() {
    glob(args.transactionLog, null, function (er, files) {
        if (er) {
            console.log(er);
        }

        files.forEach(async function (file) {
            await processLines(file);

            let sendingDuration = ((latestTxSendTime.subtract(oldestTxSendTime)).toJSNumber()) / 1e6;

            console.log("Sent transactions:", totalTxs, "| Failed transactions:", failedTxs, "| Failure rate:", failedTxs / totalTxs);
            console.log("First send time:", oldestTxSendTime.toString(), "| Latest send time:", latestTxSendTime.toString(), "| Total sending duration (sec):", sendingDuration, "| AVG send rate (tps):", totalTxs / sendingDuration);
            console.log("Max delay (sec):", maxDelay, "| Min delay (sec):", minDelay, "| Avg delay (sec):", avgDelay / (totalTxs - failedTxs));
        });
    });
}

/**
 * Get line count of the file
 *
 * @param file
 * @returns {Promise}
 */
function getLineCount(file) {
    return new Promise(resolve => {
        let lineCount = 0;

        let lineReader = new LineByLineReader(file);

        lineReader.on('line', function () {
            lineCount++;
        }).on('end', function () {
            resolve(lineCount);
        });
    });
}

/**
 * Process each input file line
 *
 * @param file
 * @returns {Promise}
 */
async function processLines(file) {
    totalTxs = await getLineCount(file);
    let bar = new ProgressBar('Additional data processing :current/:total [:bar] | :rate/s | :percent | ETA: :etas', {total: totalTxs});

    return new Promise(resolve => {
        let processed = 0;

        let lineReader = new LineByLineReader(file);
        let limiter = new RateLimiter(1000, 'second');

        lineReader.on('line', async function (line) {
            limiter.removeTokens(1, async function(err, remainingRequests) {
                let txData = line.split(',');
                let hash = txData[0];
                let sendTime = bigInt(txData[1]);
                bar.tick();

                if (hash === 'undefined') {
                    failedTxs++;
                } else {
                    let tx = await getTx(hash);

                    if (!tx || !tx.value) {
                        failedTxs++;
                    } else {
                        // Save oldest and latest transactions
                        if (oldestTxSendTime.eq(-1) || !sendTime.gt(oldestTxSendTime)) {
                            oldestTxSendTime = bigInt(sendTime);
                            firstTx = hash;
                        }

                        if (latestTxSendTime.eq(-1) || sendTime.gt(latestTxSendTime)) {
                            latestTxSendTime = sendTime;
                            lastTx = hash;
                        }

                        // Save transaction delay => confirmation time - sending time
                        let block = await getBlock(tx.blockNumber);
                        let timestamp = bigInt(block.timestamp).divide(1e3);
                        let delay = (timestamp.subtract(sendTime)) / 1e6;
                        // Sub-zero delay might come from NTP sync differences. For now they can be ignored due to the minuscule value
                        if (delay < 0) delay = 0;
                        if (minDelay === -1 || delay < minDelay) minDelay = delay;
                        if (delay > maxDelay) maxDelay = delay;
                        avgDelay += delay;
                    }
                }

                processed++;
                if (processed === totalTxs) resolve();
            });
        });
    });
}

/**
 * Get transaction based on its hash
 *
 * @param hash
 * @returns {Promise}
 */
function getTx(hash) {
    return new Promise(resolve => {
        if (hash === 'undefined') {
            resolve(null);
        }

        web3.eth.getTransaction(hash, function (err, result) {
            if (err) {
                console.log(err);
                process.exit();
            }

            resolve(result);
        });
    });
}

/**
 * Get a block based in its index
 *
 * @param n
 * @returns {Promise}
 */
function getBlock(n) {
    return new Promise(resolve => {
        web3.eth.getBlock(n, function (err, result) {
            if (err) {
                console.log(err);
            }

            resolve(result);
        });
    });
}

