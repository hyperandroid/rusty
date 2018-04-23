"use strict";
var __extends = (this && this.__extends) || (function () {
    var extendStatics = Object.setPrototypeOf ||
        ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
        function (d, b) { for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p]; };
    return function (d, b) {
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
exports.__esModule = true;
var request = require("request");
var process = require("process");
var ConversationHelper = (function () {
    function ConversationHelper(bh, user, team, response, body) {
        this.responded = false;
        this.bh = bh;
        this.response = response;
        this.body = body;
        this.user = user;
        this.team = team;
    }
    ConversationHelper.prototype.reply = function (message, attachments_, ephemeral, callback) {
        var channel = this.body.channel_id;
        var token = this.team.bot.app_token;
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
            text: message
        };
        if (ephemeral) {
            form.user = this.user.id;
        }
        if (attachments.length > 0) {
            form.attachments = JSON.stringify(attachments);
        }
        request
            .post('https://slack.com/api/' + endPoint, {
            headers: {
                'content-type': 'application/json; charset=utf-8'
            },
            form: form
        }, function (error, response, body_) {
            var body = JSON.parse(body_);
            if (typeof callback !== 'undefined') {
                callback(body);
            }
            if (error || response.statusCode !== 200 || body.ok === false) {
                console.log(error, body);
            }
        });
    };
    /**
     * Send a message to registered channel incoming webhook.
     *
     *
     * @param {string} message
     * @param {Attachment[]} attachments optional attachment collection.
     */
    ConversationHelper.prototype.sendToIncomingWebHook = function (message, attachments) {
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
                attachments: (typeof attachments !== 'undefined' ? attachments : [])
            }
        }, function (error, response, body) {
            if (error) {
                console.log(error);
            }
        });
    };
    /**
     * Interactive calls, don't need to be ack'ed.
     *
     *
     * @param {InteractiveOptions} options
     */
    ConversationHelper.prototype.interactive = function (options) {
        var _this = this;
        var callback_id = '';
        options.attachments.forEach(function (attachment) {
            if (typeof attachment.callback_id !== 'undefined') {
                callback_id = attachment.callback_id;
            }
        });
        if (callback_id !== '') {
            this.reply('', options.attachments, options.ephemeral, function (body) {
                var ts = '';
                try {
                    ts = body.event.ts; // para update, el timestamp del mensaje a modificar es este.
                }
                catch (e) {
                    ts = body.message_ts;
                }
                console.log("received reply to interactive " + JSON.stringify(body));
                // on reply callback, take message ts identifier to make responses.
                _this.bh.__registerInteractiveRequest(_this.user.id, callback_id, ts, function (hc, actions) {
                    actions.forEach(function (action) {
                        var on_callback = options.on[action.value];
                        if (typeof on_callback === 'undefined') {
                            on_callback = options.on['id_default'];
                        }
                        if (typeof on_callback !== 'undefined') {
                            on_callback(hc, actions);
                        }
                        else {
                            //
                            console.info("UUID:" + callback_id + " interactive action " + action.value + " w/o handler.");
                        }
                    });
                });
            });
        }
        else
            console.error('Interactive w/o callback_id on attachments.');
    };
    ConversationHelper.RandomCallbackUUID = function () {
        var b = Buffer.alloc(16);
        b.writeDoubleBE(process.hrtime()[1], 0);
        b.writeDoubleBE(process.hrtime()[1], 8);
        var hexNum = b.toString('hex');
        return hexNum.substr(0, 8) + '-' +
            hexNum.substr(8, 4) + '-' +
            hexNum.substr(12, 4) + '-' +
            hexNum.substr(16, 4) + '-' +
            hexNum.substr(20);
    };
    ConversationHelper.prototype.__respond = function (code, message) {
        if (this.responded) {
            return;
        }
        this.response.status(code).send(message);
        this.responded = true;
    };
    return ConversationHelper;
}());
exports.ConversationHelper = ConversationHelper;
var InteractiveConversationHelper = (function (_super) {
    __extends(InteractiveConversationHelper, _super);
    function InteractiveConversationHelper(bh, user, team, response, body, callback_id) {
        var _this = _super.call(this, bh, user, team, response, body) || this;
        _this.callback_id = callback_id;
        _this.response_url = body.response_url;
        return _this;
    }
    /**
     * set an interactive message reply.
     * In this case, we just return back immediately a response to slack.
     *
     * Other ways of communicating back to slack would be:
     *   + use internal response_url
     *   + if original message is not ephemeral, body payload will include an 'original_message'
     *     field that could be used to replace or modify the original message.
     *
     *   request.post(
     *       "https://slack.com/api/chat.update",
     *       {
     *           headers: {
     *               'content-type': 'application/json; charset=utf-8'
     *           },
     *           form: {
     *               token: this.user.access_token,
     *               channel: this.body.channel_id,
     *               attachments: JSON.stringify(attachments),
     *               ts: body.original_message.ts,
     *               as_user: true,
     *           }
     *       },
     *       (error: Error, response: request.Response, body: any) => {
     *           console.log(body);
     *       });
     *
     *  or
     *
     *   request.post(
     *       this.request_url,
     *       {
     *           headers: {
     *               'content-type': 'application/json; charset=utf-8'
     *           },
     *           form: {
     *               token: this.user.access_token,
     *               channel: this.body.channel_id,
     *               attachments: JSON.stringify(attachments)
     *           }
     *       },
     *       (error: Error, response: request.Response, body: any) => {
     *           console.log(body);
     *       });
     *
     * @param attachments {string|Attachment[]} reply text
     * @param ephemeral {boolean} set this reply ephemeral
     * @param replaceOriginal {boolean} replace original interactive message.
     *
     */
    InteractiveConversationHelper.prototype.setReply = function (attachments, ephemeral, replaceOriginal) {
        var ts = this.bh.__unregisterInteractiveRequest(this.user.id, this.callback_id);
        console.log('updating message : ' + ts);
        if (typeof attachments !== 'undefined') {
            var res = {
                replace_original: replaceOriginal
            };
            if (typeof attachments === 'string') {
                res.text = attachments;
            }
            else {
                res.attachments = attachments;
            }
            if (ephemeral) {
                res.response_type = "ephemeral";
            }
            this.__respond(200, res);
        }
    };
    return InteractiveConversationHelper;
}(ConversationHelper));
exports.InteractiveConversationHelper = InteractiveConversationHelper;
