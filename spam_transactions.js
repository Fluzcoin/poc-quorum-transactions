let Web3 = require('web3');
let web3 = new Web3();
const fs = require('fs');
let glob = require("glob");
let readline = require('readline');
let ejs = require('ethereumjs-wallet');
let ms = require('microtime');
let RateLimiter = require('limiter').RateLimiter;

/**
 * Handle arguments
 */
let minimist = require('minimist');
let args = minimist(process.argv.slice(2), {
    string: ['provider', 'tps', 'txcount', 'protocol'],

    unknown: function () {
        console.log('Invalid arguments');
        process.exit();
    }
});

let limiter = new RateLimiter(args.tps, 'second');
let filename = '';

if (args.protocol === 'websocket') {
    web3.setProvider(new web3.providers.WebsocketProvider(args.provider));
    filename = "account-list-" + args.provider.substring(5);
} else if (args.protocol === 'ipc') {
    let net = require('net');
    web3.setProvider(new web3.providers.IpcProvider(args.provider, net));
    filename = "account-list-127.0.0.1";
} else {
    web3.setProvider(new web3.providers.HttpProvider(args.provider));
    filename = "account-list-" + args.provider.substring(7);
}

glob(filename, null, function (er, files) {
    files.forEach(function (file) {
        let lineReader = readline.createInterface({
            input: fs.createReadStream(file)
        });

        lineReader.on('line', async function (line) {
            // Wait until account is unlocked before spamming transactions from it
            await unlock(line);

            for (let i = 0; i < args.txcount; i++) {
                sendTransactions(line);
            }
        });
    })
});

/**
 * Throttled transaction sending based on input data
 *
 * @param account
 */
function sendTransactions(account) {
    limiter.removeTokens(1, function(err, remainingRequests) {
        web3.eth.sendTransaction({
            from: account,
            gas: 400000000,
            to: Buffer.from(ejs.generate().getAddress()).toString('hex'),
            value: Math.ceil(Math.random() * 3)
        }, function (error, result) {
            fs.appendFile('out.txt', result + ',' + ms.now() + '\n', function (err) {
                if (err) throw err;
            });

            if (error) {
                console.error(error);
            }
        });
    });
}

/**
 * Unlock an account
 *
 * @param acc
 * @returns {Promise}
 */
function unlock(acc) {
    return new Promise(resolve => {
        web3.eth.personal.unlockAccount(acc, "", 0, function () {
            resolve();
        });
    });
}