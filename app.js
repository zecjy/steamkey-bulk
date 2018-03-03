var SteamCommunity = require('steamcommunity');
var readline = require('readline-sync');
var fs = require('fs');
var program = require('commander');

var community = new SteamCommunity();
var cmdValue;

var accounts = [];
try {
    var accounts = require('./accounts.json');
} catch (e) {
    if (e.code == 'MODULE_NOT_FOUND')
        console.log("Please add some accounts first!");
    else
        console.log(e.code);
}

program
    .arguments('<cmd>')
    .action(function (cmd) {
        cmdValue = cmd;
    });

program.parse(process.argv);

switch (cmdValue) {
    case 'add':
        addAccount();
        break;
    case 'test':
        testAccounts();
        break;
	case 'key':
		var choice = readline.keyInSelect(['Keys from file', 'Single key'], 'Choose option');
        switch (choice) {
            case -1:
                process.exit();
                break;
            case 0:
                registerKeys();
                break;
            case 1:
                registerKey();
                break;
        }
        break;
    case 'help':
        console.log("Commands:\nadd - Add a new account\ntest - test all accounts\nkey - activate key/keys");
        process.exit();
        break;
    default:
        console.log("No command given.")
        process.exit();
};
	
function registerKeys() {
	var account = chooseAccount();
	commununity = new SteamCommunity();
	
	var keys = fs.readFileSync('keys.txt', 'utf-8').split('\n');
    keys.reduce((promiseChain, product_key, key) => {
        return promiseChain.then(() => new Promise((resolve) => {
            activateKey(product_key, account, () => {
				resolve();
			});
        }));
    }, Promise.resolve());
}

function registerKey() {
	var account = chooseAccount();
	var product_key = readline.question("Steam key: ");
	commununity = new SteamCommunity();
	activateKey(product_key, account);
}

function activateKey(product_key, account, callback) {
	community.oAuthLogin(account["steamguard"], account["oAuthToken"], (err) => {
		if (!err) {
			community.httpRequestPost({
				"uri": "https://store.steampowered.com/account/ajaxregisterkey/",
				"form": {
					"sessionid": community.getSessionID(),
					"product_key": product_key
				}
			}, function (err, res, body) {
				if (body.purchase_result_details == 0)
					console.log(body.purchase_receipt_info.line_items.line_item_description + " activated.");
				else if (body.purchase_result_details == 9)
					console.log(body.purchase_receipt_info.line_items.line_item_description + " is already in your library.");
				else if (body.purchase_result_details == 14)
					console.log("Wrong key");
				else if (body.purchase_result_details == 15)
					console.log(body.purchase_receipt_info.line_items.line_item_description + " is already used.");
				else if (body.purchase_result_details = 53)
					console.log("Rate limited. Wait some time and try again.");
				callback();
			}, "steamcommunity");
		} else {
			console.log(account["username"] + " isn't working and got removed!");
			accounts.splice(key, 1);
			fs.writeFile("accounts.json", JSON.stringify(accounts), "utf8");
		}
	});
}

function chooseAccount() {
	var accountNames = [];
	accounts.forEach((account) => {
		accountNames.push(account["username"]);
	});
	var accountId = readline.keyInSelect(accountNames, 'Choose account');
	return accounts[accountId];
}

function doLogin(accountName, password, authCode, mobileCode, captcha) {
	if(authCode) {
		var details = {
			"accountName": accountName,
			"password": password,
			"authCode": authCode,
			"captcha": captcha,
		}
	} else if(mobileCode) {
		console.log("!");
		var details = {
			"accountName": accountName,
			"password": password,
			"twoFactorCode": mobileCode,
			"captcha": captcha,
		}
	} else {
		var details = {
			"accountName": accountName,
			"password": password,
			"captcha": captcha,
		}
	}
    community.login(details, function (err, sessionID, cookies, steamguard, oAuthToken) {
        if (err) {
            if (err.message == 'SteamGuard') {
                console.log("An email has been sent to your address at " + err.emaildomain);
                doLogin(accountName, password, readline.question("Steam Guard Code: "));
                return;
			} else if (err.message == 'SteamGuardMobile') {
				doLogin(accountName, password, null, readline.question("Input your mobile code: "));
                return;
			}  else if (err.message == 'CAPTCHA') {
                console.log(err.captchaurl);
                doLogin(accountName, password, null, question("CAPTCHA: "));
                return;
            }
            console.log(err);
            process.exit();
            return;
        }
        addAccount(accountName, steamguard, oAuthToken);
    });
}

function testAccounts() {
    accounts.reduce((promiseChain, account, key) => {
        return promiseChain.then(() => new Promise((resolve) => {
            community = new SteamCommunity();
            community.oAuthLogin(account["steamguard"], account["oAuthToken"], (err) => {
                if (!err) {
                    console.log(account["username"] + " is working fine!");
                } else {
                    console.log(account["username"] + " isn't working and got removed!");
                    accounts.splice(key, 1);
                    fs.writeFile("accounts.json", JSON.stringify(accounts), "utf8");
                }
                setTimeout(() => {
                    resolve();
                }, 1000);
            });
        }));
    }, Promise.resolve());
}

function addAccount(username, steamguard, oAuthToken) {
    if (username && steamguard && oAuthToken) {
        accounts.push({
            "username": username,
            "steamguard": steamguard,
            "oAuthToken": oAuthToken
        });
        fs.writeFile("accounts.json", JSON.stringify(accounts), "utf8", () => {
            console.log("Account added successfully!");
        });
    } else {
        var username = readline.question('Username: ');
        var password = readline.question('Password: ');
        if (!accountCheck(username)) {
            doLogin(username, password);
        } else {
            console.log("Stopped.");
        }
    }
}

function accountCheck(username) {
    for (var key = 0; key < accounts.length; key++) {
        let account = accounts[key];
        if (account.username == username) {
            if (readline.keyInYN('Account allready added, re-login?')) {
                accounts.splice(key, 1);
                return false;
            } else {
                return true;
            }
        }
    }
    return false;
}