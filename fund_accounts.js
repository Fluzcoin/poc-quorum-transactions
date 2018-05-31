var Web3 = require('web3');
var web3 = new Web3();
const fs = require('fs');
var glob = require("glob");
var readline = require('readline');

/**
 * Handle arguments
 */
var minimist = require('minimist');
var args = minimist(process.argv.slice(2), {
    string: ['fundingProvider', 'fundingAccount'],

    unknown: function () {
        console.log('Invalid arguments');
        process.exit();
    }
});

web3.setProvider(new web3.providers.HttpProvider(args.fundingProvider));
web3.eth.personal.unlockAccount(args.fundingAccount, "", 3600);

/** Fund accounts **/

// options is optional
glob("account-list-*", null, function (er, files) {
    files.forEach(function(file) {
        var lineReader = readline.createInterface({
            input: fs.createReadStream(file)
        });

        lineReader.on('line', function (line) {
            web3.eth.sendTransaction({from:args.fundingAccount, to:line, value: 100000}, function (error, result) {
                console.log(result);
            });
        });
    })
});
