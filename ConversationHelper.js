"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var request = require("request");
var ConversationHelper = (function () {
    function ConversationHelper(bh, user, team, response, body) {
        this.bh = bh;
        this.response = response;
        this.body = body;
        this.user = user;
        this.team = team;
    }
    ConversationHelper.prototype.reply = function (message, attachments_, ephemeral) {
        var channel = this.body.channel_id;
        var token = this.team.incoming_web_hook.token;
        var endPoint = 'chat.postMessage';
        if (ephemeral) {
            endPoint = 'chat.postEphemeral';
        }
        var attachments = [];
        if (typeof attachments_ !== 'undefined') {
            if (Array.isArray(attachments_)) {
                attachments = attachments_;
            }
            else {
                attachments = [attachments_];
            }
        }
        var form = {
            token: token,
            channel: channel,
            text: message,
        };
        if (attachments.length > 0) {
            form.attachments = JSON.stringify(attachments);
        }
        request
            .get('https://slack.com/api/' + endPoint, {
            headers: {
                'content-type': 'application/json; charset=utf-8'
            },
            qs: form
        }, function (error, response, body_) {
            var body = JSON.parse(body_);
            if (error || response.statusCode !== 200 || body.ok === false) {
                console.log(error, body);
            }
        });
        this.response.status(200).send('');
    };
    ConversationHelper.prototype.sendToIncomingWebHook = function (message) {
        var url = '';
        try {
            url = this.team.incoming_web_hook.url;
        }
        catch (e) {
            console.error("Can't find a team, or team w/o web hook info.");
            return;
        }
        request({
            method: "POST",
            url: url,
            headers: { 'content-type': 'application/json' },
            json: {
                text: message,
            }
        }, function (error, response, body) {
            if (error) {
                console.log(error);
            }
        });
    };
    ConversationHelper.prototype.addReaction = function () {
    };
    ConversationHelper.prototype.startConversation = function () {
    };
    return ConversationHelper;
}());
exports.ConversationHelper = ConversationHelper;
//# sourceMappingURL=ConversationHelper.js.map