let Web3 = require('web3');
let web3 = new Web3();
const fs = require('fs');

/**
 * Handle arguments
 */
let minimist = require('minimist');
let args = minimist(process.argv.slice(2), {
    string: ['providers', 'count', 'protocol'],

    unknown: function () {
        console.log('Invalid arguments');
        process.exit();
    }
});


/** Create a bunch of accounts on different providers **/

let providerArray = args.providers.split(',');

providerArray.forEach(function (provider) {
    let filename = '';

    if (args.protocol === 'websocket') {
        web3.setProvider(new web3.providers.WebsocketProvider(provider));
        filename = 'account-list-' + provider.substring(5);
    } else if (args.protocol === 'ipc') {
        let net = require('net');
        web3.setProvider(new web3.providers.IpcProvider(provider, net));
        filename = 'account-list-127.0.0.1';
    } else {
        web3.setProvider(new web3.providers.HttpProvider(provider));
        filename = 'account-list-' + provider.substring(7);
    }

    for (let i = 0; i < args.count; i++) {
        web3.eth.personal.newAccount('', function (error, result) {
            if (error) {
                console.log(error);
            }

            fs.appendFile(filename, result + '\n', function (err) {
                if (err) throw err;
            });
        });
    }
});

