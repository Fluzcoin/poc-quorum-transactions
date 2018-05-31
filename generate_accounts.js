var Web3 = require('web3');
var web3 = new Web3();
const fs = require('fs');

/**
 * Handle arguments
 */
var minimist = require('minimist');
var args = minimist(process.argv.slice(2), {
    string: ['providers', 'count'],

    unknown: function () {
        console.log('Invalid arguments');
        process.exit();
    }
});


/** Create a bunch of accounts on different providers **/

var providerArray = args.providers.split(',');

providerArray.forEach(function(provider) {
    web3.setProvider(new web3.providers.HttpProvider(provider));

    for (var i = 0; i < args.count; i++) {
        web3.eth.personal.newAccount('', function (error, result) {
            fs.appendFile('account-list-'+provider.substring(7), result + '\n', function (err) {
                if (err) throw err;
            });
        });
    }
});

