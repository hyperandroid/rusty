/**
 * Languagenius is an slack bot that converts slang acronyms to their meaning.
 * Invoked as:
 *
 *  `/slang ttyl nm`
 *
 * will return a description of what `ttyl` and `nm` means. It will report back unknown acronyms.
 */

import express = require("express");
import bodyParser = require('body-parser');
import Rusty, {HandlerProperties} from "../Rusty";
import {Attachment, ConversationHelper} from "../ConversationHelper";
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

const storage = new StorageImpl(__dirname+"/..");

const bh = new Rusty(storage)
    .onAuthorization( ( user: User, team: Team ) => {
        storage.addUser(user);
        storage.addTeam(team);
    })
    .installForWebServer(app, credentials)
    .onSlashCommand(
        '/slang',
        (ch:ConversationHelper, command:string, text:string) => {

            if (command==='/slang' ) {
                const {rightStr, wrongStr} = slangVerb(text.split(' '));

                const attachments : Attachment[] = [];

                if ( rightStr!=='' ) {
                    attachments.push({
                        fallback : rightStr,
                        color : '#208020',
                        pretext : 'Translations:',
                        text : rightStr,
                        mrkdwn_in : ['text', 'pretext']
                    });
                }

                if ( wrongStr!=='' ) {
                    attachments.push({
                        fallback : wrongStr,
                        color : '#a03030',
                        pretext : 'Not found translations:',
                        text : wrongStr,
                        mrkdwn_in : ['text', 'pretext']
                    });
                }

                ch.reply('', attachments, true );
            } else {
                ch.reply('unknown command', null,true);
            }
        });


const slangMap = {
    'afk'  : 'Away From Keyboard',
    'afaik': 'As Far As I Know',
    'aka'  : 'Also Known As',
    'asap' : 'As Soon As Possible',
    'atm'  : 'At The Moment',
    'btw'  : 'By The Way',
    'brb'  : 'Be Right Back',
    'cu'   : 'See You',
    'dnd'  : 'Do Not Disturb',
    'diy'  : 'Do It Yourself',
    'eta'  : 'Estimated Time of Arrival',
    'eod'  : 'End Of Discussion',
    'faq'  : 'Frequently Asked Question',
    'ftw'  : 'For The Win',
    'fyi'  : 'For Your Information',
    'gg'   : 'Good Game',
    'gtfo' : 'Get The F**k Out',
    'icymi': 'In Case You Missed It',
    'iirc' : 'If I Remind Correctly',
    'imo'  : 'In My Opinion',
    'imho' : 'In My Humble Opinion',
    'l8r'  : 'Later',
    'lmao' : 'Laugh My Ass Off',
    'lkm'  : 'Let Me Know',
    'lol'  : 'Laugh Out Loudly',
    'nntr' : 'No Need To Reply',
    'nm'   : 'Never Mind',
    'omg'  : 'Oh My God',
    'omfg' : 'Oh My F***ing God',
    'omw'  : 'On My Way',
    'otoh' : 'On The Other Hand',
    'rotfl': 'Rolling On The Floor Laughing',
    'rsvp' : 'Please Reply',
    'pr'   : 'Press Relations',
    'pst'  : 'Piece Of Shit',
    'tba'  : 'To Be Announced',
    'tbc'  : 'To Be Continued',
    'ttyl' : 'Talk To You Later',
    'til'  : 'Today I Learnt',
    'tyt'  : 'Take Your Time',
    'wfm'  : 'Works For Me',
    'wtf'  : 'What The F**k',
    'rtfm' : 'Read The F**king Manual',
};

interface SlangVerbResult {
    rightStr : string;
    wrongStr : string;
}

function slangVerb( words: string[] ) : SlangVerbResult {

    // try no find a match for the following definitions:

    const wrong : string[] = [];
    const right : string[][] = [];

    words.forEach( w => {
        const definition = slangMap[w.toLocaleLowerCase()];
        if ( typeof definition==='undefined' ) {
            wrong.push(w);
        } else {
            right.push( [w, definition] );
        }
    });

    let wrongStr = "";

    if ( wrong.length>0 ) {
        wrongStr= `I don't know what these mean: ${wrong.map( w => {return "_"+w+"_"} )}\n`;
    }

    let rightStr= "";
    if ( right.length>0 ) {
        right.forEach( (pair, index) => {
            rightStr+= `*${pair[0]}* = ${pair[1]}`;
            if ( index<right.length-1 ) {
                rightStr+="\n";
            }
        });
    }

    return {rightStr, wrongStr};
}
