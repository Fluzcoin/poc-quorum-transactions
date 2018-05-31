var Web3 = require('web3');
var web3 = new Web3();
const fs = require('fs');
var glob = require("glob");
var readline = require('readline');
var ejs = require('ethereumjs-wallet');

/**
 * Handle arguments
 */
var minimist = require('minimist');
var args = minimist(process.argv.slice(2), {
    string: ['provider', 'txamount'],

    unknown: function () {
        console.log('Invalid arguments');
        process.exit();
    }
});

web3.setProvider(new web3.providers.HttpProvider(args.provider));

glob("account-list-"+args.provider.substring(7), null, function (er, files) {
    files.forEach(function(file) {
        var lineReader = readline.createInterface({
            input: fs.createReadStream(file)
        });

        lineReader.on('line', function (line) {
            web3.eth.personal.unlockAccount(line, "", 72000);

            for(var i = 0; i < args.txamount; i++) {
                web3.eth.sendTransaction({from:line, to:Buffer.from(ejs.generate().getAddress()).toString('hex'), value: Math.ceil(Math.random() * 3)}, function (error, result) {
                    console.log(result);

                    if (error) {
                        console.error(error);
                    }
                });
            }
        });
    })
});
