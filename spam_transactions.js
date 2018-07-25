let Web3 = require('web3');
let web3 = new Web3();
const fs = require('fs');
let glob = require("glob");
let readline = require('readline');
let ejs = require('ethereumjs-wallet');
let ms = require('microtime');

/**
 * Handle arguments
 */
let minimist = require('minimist');
let args = minimist(process.argv.slice(2), {
    string: ['provider', 'txamount'],

    unknown: function () {
        console.log('Invalid arguments');
        process.exit();
    }
});

web3.setProvider(new web3.providers.HttpProvider(args.provider));

glob("account-list-" + args.provider.substring(7), null, function (er, files) {
    files.forEach(function (file) {
        let lineReader = readline.createInterface({
            input: fs.createReadStream(file)
        });

        lineReader.on('line', async function (line) {
            await unlock(line);

            for (let i = 0; i < args.txamount; i++) {
                web3.eth.sendTransaction({
                    from: line,
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
            }
        });
    })
});

function unlock(acc) {
    return new Promise(resolve => {
        web3.eth.personal.unlockAccount(acc, "", 72000, function () {
            resolve();
        });
    });
}