"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var express = require("express");
var bodyParser = require("body-parser");
var Rusty_1 = require("../Rusty");
var fs = require("fs");
var Storage_1 = require("../storage/Storage");
var app = express();
var PORT = 4690;
app.use(bodyParser.json()); // for parsing application/json
app.use(bodyParser.urlencoded({ extended: true }));
app.listen(PORT, function () {
    console.log("Example app listening on port " + PORT);
});
app.get("/", function (req, res) {
    res.send("hey ya!!");
});
/**
 *  {
 *      OAuth : {
 *          client_id : 'YOUR_APP_CLIENT_ID',
 *          client_secret : 'YOUR_APP_CLIENT_SECRET'
 *          end_point : 'optional oauth endpoint. default is /oauth'
 *      },
 *      Web : {
 *          tokens : [YOUR_APP_TOKEN]
 *          end_point : 'options slash command/event/webhood endpoint. default is /event'
 *      }
 *  }
 *
 */
var credentials;
try {
    credentials = JSON.parse(fs.readFileSync(__dirname + "/../credentials.json").toString());
}
catch (e) {
    console.error("can't load credentials: ", e);
    process.exit(-1);
}
function RandomCallbackUUID() {
    var b = Buffer.alloc(16);
    b.writeDoubleBE(process.hrtime()[1], 0);
    b.writeDoubleBE(process.hrtime()[1], 8);
    var hexNum = b.toString('hex');
    return hexNum.substr(0, 8) + '-' +
        hexNum.substr(8, 4) + '-' +
        hexNum.substr(12, 4) + '-' +
        hexNum.substr(16, 4) + '-' +
        hexNum.substr(20);
}
var storage = new Storage_1.default(__dirname + "/..");
var bh = new Rusty_1.default(storage)
    .onAuthorization(function (user, team) {
    storage.addUser(user);
    storage.addTeam(team);
})
    .installForWebServer(app, credentials)
    .onEvent(['hey (.*)'], ['direct_message', 'direct_mention', 'mention', 'app_mention'], function (ch, heard) {
    ch.reply(heard.matches[1]);
    ch.sendToIncomingWebHook('lololol');
})
    .onEvent(['test(.*)'], ['direct_mention', 'mention', 'app_mention'], function (ch, heard) {
    var interactive_1 = {
        ephemeral: true,
        attachments: [
            {
                title: 'Message 1',
                fallback: 'Message 1',
                callback_id: RandomCallbackUUID(),
                attachment_type: 'default',
                actions: [
                    {
                        name: 'id_2',
                        type: 'button',
                        text: 'Go To 2',
                        value: '2'
                    },
                    {
                        name: 'id_3',
                        type: 'button',
                        text: 'Go To 3',
                        value: '3'
                    },
                ]
            }
        ],
        on: {
            '2': function (ich, actions) {
                ich.interactive(interactive_2);
                ich.setReply([
                    {
                        text: "Your choice: " + actions.map(function (action) {
                            return action.value;
                        }),
                        fallback: "",
                        color: '#902020'
                    }
                ], true, true);
            },
            '3': function (ich, actions) {
                ich.interactive(interactive_3);
                ich.setReply([
                    {
                        text: "Your choice: *" + actions.map(function (action) {
                            return action.value;
                        }) + "*",
                        fallback: "",
                        color: '#209020',
                        pretext: "Selected 3 as option",
                    }
                ], true, false);
            }
        },
    };
    var interactive_2 = {
        ephemeral: true,
        on: {
            'id_default': function (ich, actions) {
                ich.interactive(interactive_3);
                ich.setReply([
                    {
                        text: "Your choice: *" + actions.map(function (action) {
                            return action.value;
                        }) + "*",
                        fallback: "",
                        color: '#902090',
                        pretext: "JAJEJO",
                    }
                ], false, true);
            }
        },
        attachments: [
            {
                title: 'Message 2',
                fallback: 'message 2',
                callback_id: RandomCallbackUUID(),
                attachment_type: 'default',
                actions: [
                    {
                        name: 'id_3',
                        type: 'button',
                        text: 'Go To 3',
                        value: '3'
                    }
                ]
            }
        ]
    };
    var interactive_3 = {
        ephemeral: true,
        on: {
            'id_default': function (ich, actions) {
                ich.interactive(interactive_1);
                ich.setReply("reply reply", false, false);
            }
        },
        attachments: [
            {
                title: 'Message 3',
                fallback: 'message 3',
                callback_id: RandomCallbackUUID(),
                attachment_type: 'default',
                actions: [
                    {
                        name: 'id_1',
                        type: 'button',
                        text: 'Go To 1',
                        value: '1'
                    }
                ]
            }
        ]
    };
    ch.interactive(interactive_1);
});
//# sourceMappingURL=conversation.js.map