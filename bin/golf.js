const Web3 = require('web3');
const Tx = require('ethereumjs-tx');
const readline = require("readline");


let web3 = {};
let privKey = ""
let contractAddress = "0x9005e309180b4892d471d77fe998f390de1084ad";
let walletAddress = ""
let nodeURL= "https://dai.poa.network"
let golfABI = [{"constant":false,"inputs":[{"name":"playerAddress","type":"address"}],"name":"login","outputs":[{"name":"success","type":"bool"}],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":true,"inputs":[{"name":"","type":"uint16"}],"name":"shots","outputs":[{"name":"player","type":"address"},{"name":"shotMetrics","type":"string"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":false,"inputs":[{"name":"player","type":"address"},{"name":"shotMetrics","type":"string"}],"name":"recordNewShot","outputs":[{"name":"success","type":"bool"}],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":false,"inputs":[{"name":"playerAddress","type":"address"},{"name":"first","type":"string"},{"name":"last","type":"string"},{"name":"company","type":"string"}],"name":"createPlayer","outputs":[{"name":"success","type":"bool"}],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":true,"inputs":[{"name":"_player","type":"address"}],"name":"getPlayerShots","outputs":[{"name":"playerShotIds","type":"uint16[]"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[],"name":"getAllShots","outputs":[{"name":"shotId","type":"uint16[]"},{"name":"player","type":"address[]"},{"name":"shotMetrics","type":"string[]"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[{"name":"","type":"address"}],"name":"players","outputs":[{"name":"first","type":"string"},{"name":"last","type":"string"},{"name":"company","type":"string"},{"name":"sessions","type":"uint8"}],"payable":false,"stateMutability":"view","type":"function"},{"inputs":[],"payable":false,"stateMutability":"nonpayable","type":"constructor"},{"anonymous":false,"inputs":[{"indexed":true,"name":"_player","type":"address"}],"name":"PlayingGame","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"name":"_player","type":"address"},{"indexed":true,"name":"_shotId","type":"uint16"},{"indexed":false,"name":"shotMetrics","type":"string"}],"name":"Swing","type":"event"}]


function sendSigned(txData, cb) {
    const privateKey = Buffer.from(privKey, 'hex');
    const transaction = new Tx(txData);
    transaction.sign(privateKey);
    const serializedTx = transaction.serialize().toString('hex');
    web3.eth.sendSignedTransaction(`0x${serializedTx}`, cb);
}

function connect() {
    // Setup the connection to geth node
    web3 = new Web3(new Web3.providers.HttpProvider(nodeURL));
    return new Promise((resolve,reject) => {
        web3.eth.getTransactionCount(walletAddress, "pending").then((txCount) => {
            nonce = txCount;
            resolve();
        }, (err) => {
            reject(err);
        });
    });
}


const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

connect();
var searchArgs, command

// Main loop waiting for commands from splunk
rl.on("line", input => {
  if (input.indexOf("chunk") != -1) {
    // Not sure why but a newline is needed
    rl.write("\n");
  } else if (input.indexOf("getinfo") != -1) {
    // This is the Initial Message from splunk v2

    command = JSON.parse(input).searchinfo.args[0];
    searchArgs = arrToMap(JSON.parse(input).searchinfo.args.slice(1));
    // Now we tell splunk what type of command it is
    var meta = '{"generating": true, "type": "events"}';

    commandArgs = searchArgs.commandArgs;

    console.log(`chunked 1.0,${meta.length},0\n${meta}`);
  } else if (input.indexOf("execute") != -1) {
    // Splunk is ready for the data
    // Its in csv format
    callContract(command, commandArgs);
    //contractToCall[command](...eval(commandArgs), {from:searchArgs.from}, (err,response) => sendResponse(err,response));
  }
});

var sendResponse = function(err, result) {
  var fields, headers;
  if (err != null) {
    for (key in err) {
      header = headers === undefined ? "" : (headers = `${headers},`);
      fields = fields === undefined ? "" : (fields = `${fields},`);
      headers = `${headers}${key}`;
      fields = `${fields}${escCsv(JSON.stringify(err[key]))}`;
    }
    output = `${headers},_raw\n${fields},"${escCsv(JSON.stringify(err))}"`;
  } else {
    for (key in result) {
      headers = headers === undefined ? "" : (headers = `${headers},`);
      fields = fields === undefined ? "" : (fields = `${fields},`);
      headers = `${headers}${key}`;
      fields = `${fields}${JSON.stringify(result[key])}`;
    }
    output = `${headers},sourcetype,_raw\n${fields},_json,"${escCsv(
      JSON.stringify(result)
    )}"`;
  }
  console.log(
    `chunked 1.0,21,${output.length}\n{ "finished": true }\n${output}`
  );
};

var escCsv = function(input) {
  return (input = input.replace(/"/g, '""'));
};

var arrToMap = function(args) {
  return args.reduce(function(map, obj) {
    obj = obj.split("=");
    map[obj[0]] = obj[1];
    return map;
  }, {});
};


var callContract = function (command, commandArgs) {
    const contract = new web3.eth.Contract(golfABI, contractAddress);
    const encoded = contract.methods[command](...eval(commandArgs)).encodeABI();
    return new Promise((resolve, reject) => {
        // construct the transaction data
        // TODO dynamic gasLimit and price
        const txData = {
            nonce: web3.utils.toHex(nonce),
            gasLimit: web3.utils.toHex(250000),
            gasPrice: web3.utils.toHex(10e9), // 10 Gwei
            to: contractAddress,
            from: walletAddress,
            value: '0x00',
            data: encoded
        };
        // Increase the nonce for the next txn
        nonce = nonce + 1
        // fire away!
        sendSigned(txData, (err, response) => sendResponse(err,response));
    });
};
