"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var express = require("express");
var bodyParser = require("body-parser");
var BotHandler_1 = require("../BotHandler");
var fs = require("fs");
var app = express();
var PORT = 4690;
app.use(bodyParser.json()); // for parsing application/json
app.use(bodyParser.urlencoded({ extended: true }));
app.listen(PORT, function () {
    console.log("Example app listening on port " + PORT);
});
var slangMap = {
    'afk': 'Away From Keyboard',
    'afaik': 'As Far As I Know',
    'aka': 'Also Known As',
    'asap': 'As Soon As Possible',
    'atm': 'At The Moment',
    'btw': 'By The Way',
    'cu': 'See You',
    'dnd': 'Do Not Disturb',
    'diy': 'Do It Yourself',
    'eta': 'Estimated Time of Arrival',
    'eod': 'End Of Discussion',
    'faq': 'Frequently Asked Question',
    'ftw': 'For The Win',
    'fyi': 'For Your Information',
    'gg': 'Good Game',
    'gtfo': 'Get The F**k Out',
    'icymi': 'In Case You Missed It',
    'iirc': 'If I Remind Correctly',
    'imo': 'In My Opinion',
    'imho': 'In My Humble Opinion',
    'l8r': 'Later',
    'lmao': 'Laugh My Ass Off',
    'lol': 'Laugh Out Loudly',
    'nntr': 'No Need To Reply',
    'nm': 'Never Mind',
    'omg': 'Oh My God',
    'omfg': 'Oh My F***ing God',
    'omw': 'On My Way',
    'otoh': 'On The Other Hand',
    'rotfl': 'Rolling On The Floor Laughing',
    'rsvp': 'Please Reply',
    'pr': 'Press Relations',
    'pst': 'Piece Of Shit',
    'tba': 'To Be Announced',
    'tbc': 'To Be Continued',
    'ttyl': 'Talk To You Later',
    'til': 'Today I Learnt',
    'tyt': 'Take Your Time',
    'wfm': 'Works For Me',
    'wtf': 'What The F**k',
};
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
var bh = new BotHandler_1.default()
    .installForWebServer(app, credentials)
    .onSlashCommand('/slang', function (ch, command, text) {
    if (command === '/slang') {
        var _a = slangVerb(text.split(' ')), rightStr = _a.rightStr, wrongStr = _a.wrongStr;
        var attachments = [];
        if (rightStr !== '') {
            attachments.push({
                fallback: rightStr,
                color: '#208020',
                pretext: 'Translations:',
                text: rightStr,
                mrkdwn_in: ['text', 'pretext']
            });
        }
        if (wrongStr !== '') {
            attachments.push({
                fallback: wrongStr,
                color: '#a03030',
                pretext: 'Not found translations:',
                text: wrongStr,
                mrkdwn_in: ['text', 'pretext']
            });
        }
        ch.reply('', attachments);
    }
    else {
        ch.reply('unknown command');
    }
})
    .onEvent(['hey (.*)'], ['direct_message', 'direct_mention', 'mention', 'app_mention'], function (ch, event, heard) {
    ch.reply(heard.matches[1]);
    ch.sendToIncomingWebHook('lololol');
});
function slangVerb(words) {
    // try no find a match for the following definitions:
    var wrong = [];
    var right = [];
    words.forEach(function (w) {
        var definition = slangMap[w.toLocaleLowerCase()];
        if (typeof definition === 'undefined') {
            wrong.push(w);
        }
        else {
            right.push([w, definition]);
        }
    });
    var wrongStr = "";
    if (wrong.length > 0) {
        wrongStr = "I don't know what these mean: " + wrong.map(function (w) { return "_" + w + "_"; }) + "\n";
    }
    var rightStr = "";
    if (right.length > 0) {
        right.forEach(function (pair, index) {
            rightStr += "*" + pair[0] + "* = " + pair[1];
            if (index < right.length - 1) {
                rightStr += "\n";
            }
        });
    }
    return { rightStr: rightStr, wrongStr: wrongStr };
}
//# sourceMappingURL=web.js.map