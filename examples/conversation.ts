import express = require("express");
import bodyParser = require('body-parser');
import Rusty, {HandlerProperties, HearInfo, InteractiveAction} from "../Rusty";
import {Attachment, ConversationHelper, InteractiveConversationHelper} from "../ConversationHelper";
import * as fs from "fs";
import StorageImpl from "../storage/Storage";
import {User} from "../storage/User";
import {Team} from "../storage/Team";

const app = express();
const PORT=4690;

app.use(bodyParser.json()); // for parsing application/json
app.use(bodyParser.urlencoded({ extended: true }));

app.listen(PORT, function () {
    console.log("Example app listening on port " + PORT);
});

app.get("/", function(req:express.Request, res:express.Response) {
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
let credentials : HandlerProperties;
try {
    credentials= JSON.parse(fs.readFileSync(__dirname+"/../credentials.json").toString());
} catch(e) {
    console.error("can't load credentials: ",e);
    process.exit(-1);
}


function RandomCallbackUUID() {
    let b= Buffer.alloc(16);
    b.writeDoubleBE( process.hrtime()[1], 0 );
    b.writeDoubleBE( process.hrtime()[1], 8 );
    const hexNum = b.toString('hex');
    return hexNum.substr(0, 8) + '-' +
        hexNum.substr(8, 4) + '-' +
        hexNum.substr(12, 4) + '-' +
        hexNum.substr(16, 4) + '-' +
        hexNum.substr(20);
}


const storage = new StorageImpl(__dirname+"/..");

const bh = new Rusty(storage)
    .onAuthorization( ( user: User, team: Team ) => {
        storage.addUser(user);
        storage.addTeam(team);
    })
    .installForWebServer(app, credentials)
    .onEvent(
        ['hey (.*)'],
        ['direct_message', 'direct_mention', 'mention', 'app_mention'],
        ( ch: ConversationHelper, heard:HearInfo ) => {
            ch.reply(heard.matches[1]);
            ch.sendToIncomingWebHook('lololol');
        })
    .onEvent(
        ['test(.*)'],
        ['direct_mention','mention','app_mention'],
        (ch:ConversationHelper, heard:HearInfo ) => {

            const interactive_1 = {
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
                    '2': (ich: InteractiveConversationHelper, actions: InteractiveAction[]) => {
                        ich.interactive(interactive_2);
                        ich.setReply([
                            {
                                text: `Your choice: ${actions.map((action) => {
                                    return action.value
                                }) }`,
                                fallback: ``,
                                color: '#902020'
                            }
                        ], true, true);
                    },
                    '3': (ich: InteractiveConversationHelper, actions: InteractiveAction[]) => {
                        ich.interactive(interactive_3);
                        ich.setReply([
                            {
                                text: `Your choice: *${actions.map((action) => {
                                    return action.value
                                }) }*`,
                                fallback: ``,
                                color: '#209020',
                                pretext: `Selected 3 as option`,

                            }
                        ], true, false);
                    }
                },
            };

            const interactive_2 = {
                ephemeral: true,
                on: {
                    'id_default': (ich: InteractiveConversationHelper, actions: InteractiveAction[]) => {
                        ich.interactive(interactive_3);
                        ich.setReply([
                            {
                                text: `Your choice: *${actions.map((action) => {
                                    return action.value
                                }) }*`,
                                fallback: ``,
                                color: '#902090',
                                pretext: `JAJEJO`,

                            }
                        ], false, true );
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

            const interactive_3 = {
                ephemeral: true,
                on: {
                    'id_default': (ich: InteractiveConversationHelper, actions: InteractiveAction[]) => {
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
