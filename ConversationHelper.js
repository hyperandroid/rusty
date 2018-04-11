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
Object.defineProperty(exports, "__esModule", { value: true });
var request = require("request");
var process = require("process");
var ConversationHelper = /** @class */ (function () {
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
    ConversationHelper.prototype.addReaction = function () {
    };
    /**
     * Interactive calls, don't need to be ack'ed.
     *
     *
     * @param {InteractiveOptions} options
     * @param {Attachment[]} attachments
     * @param {InteractiveCallback} callback
     */
    ConversationHelper.prototype.interactive = function (options) {
        var callback_id = '';
        options.attachments.forEach(function (attachment) {
            if (typeof attachment.callback_id !== 'undefined') {
                callback_id = attachment.callback_id;
            }
        });
        if (callback_id !== '') {
            this.bh.registerInteractiveRequest(this.user.id, callback_id, function (hc, actions) {
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
            this.reply('', options.attachments, options.ephemeral);
        }
        else
            console.error('Interactive w/o callback_id on attachments.');
    };
    ConversationHelper.RandomCallbackUUID = function () {
        var b = Buffer.alloc(16);
        b.writeDoubleBE(process.hrtime()[1], 0);
        b.writeDoubleBE(process.hrtime()[1], 8);
        var hexNum = b.toString('hex');
        var callback_id = hexNum.substr(0, 8) + '-' +
            hexNum.substr(8, 4) + '-' +
            hexNum.substr(12, 4) + '-' +
            hexNum.substr(16, 4) + '-' +
            hexNum.substr(20);
        return callback_id;
    };
    return ConversationHelper;
}());
exports.ConversationHelper = ConversationHelper;
var InteractiveConversationHelper = /** @class */ (function (_super) {
    __extends(InteractiveConversationHelper, _super);
    function InteractiveConversationHelper(bh, user, team, response, body, callback_id) {
        var _this = _super.call(this, bh, user, team, response, body) || this;
        _this.callback_id = callback_id;
        return _this;
    }
    InteractiveConversationHelper.prototype.finish = function () {
        this.bh.unregisterInteractiveRequest(this.user.id, this.callback_id);
    };
    return InteractiveConversationHelper;
}(ConversationHelper));
exports.InteractiveConversationHelper = InteractiveConversationHelper;
//# sourceMappingURL=ConversationHelper.js.map