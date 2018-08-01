let Web3 = require('web3');
let web3 = new Web3();
const fs = require('fs');
let glob = require("glob");
let readline = require('readline');

/**
 * Handle arguments
 */
let minimist = require('minimist');
let args = minimist(process.argv.slice(2), {
    string: ['fundingProvider', 'fundingAccount', 'protocol'],

    unknown: function () {
        console.log('Invalid arguments');
        process.exit();
    }
});

if (args.protocol === 'websocket') {
    web3.setProvider(new web3.providers.WebsocketProvider(args.fundingProvider));
} else if (args.protocol === 'ipc') {
    let net = require('net');
    web3.setProvider(new web3.providers.IpcProvider(args.fundingProvider, net));
} else {
    web3.setProvider(new web3.providers.HttpProvider(args.fundingProvider));
}

web3.eth.personal.unlockAccount(args.fundingAccount, "", 3600);

/** Fund accounts **/

// options is optional
glob("account-list-*", null, function (er, files) {
    files.forEach(function (file) {
        let lineReader = readline.createInterface({
            input: fs.createReadStream(file)
        });

        lineReader.on('line', function (line) {
            web3.eth.sendTransaction({from: args.fundingAccount, to: line, value: 100000}, function (error, result) {
                console.log(result);
            });
        });
    })
});
