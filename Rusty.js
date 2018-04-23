"use strict";
/**
 * Bot handler does the dirty lifting with bot providers.
 * Sets oauth and events endpoints
 *
 */
Object.defineProperty(exports, "__esModule", { value: true });
var ConversationHelper_1 = require("./ConversationHelper");
var api_1 = require("./api");
var events_1 = require("events");
function testAuth(auth_token, callback) {
    api_1.clientAPI('auth.test', {
        form: {
            token: auth_token
        },
        method: 'POST'
    }, callback);
}
var interactiveMap = {};
var Rusty = /** @class */ (function () {
    function Rusty(storage) {
        this.slashCommands = {};
        this.events = {};
        this.userEmitter = new events_1.EventEmitter();
        this.teamEmitter = new events_1.EventEmitter();
        this.storage = storage;
    }
    Rusty.prototype.installForWebServer = function (app, props) {
        this.app = app;
        this.__initializeOAuth(props.OAuth);
        this.__initializeEventsAndSlashCommands(props.Web);
        return this;
    };
    Rusty.prototype.__initializeOAuth = function (oauthProps) {
        var _this = this;
        var end_point = "/oauth";
        if (typeof oauthProps.end_point !== 'undefined') {
            end_point = oauthProps.end_point;
        }
        this.app.get(end_point, function (req, res) {
            var team;
            var user;
            if (!req.query.code) {
                res.status(500).send({ "Error": "Looks like we're not getting code." });
                console.error("Error in bot oauth.");
            }
            else {
                api_1.clientAPI('oauth.access', {
                    form: {
                        code: req.query.code,
                        client_id: oauthProps.client_id,
                        client_secret: oauthProps.client_secret
                    },
                    method: 'POST'
                }, function (error, auth) {
                    var isError = true;
                    if (!error && auth.ok === true) {
                        isError = false;
                        // test authorization token.
                        // also reliably get team_id
                        testAuth(auth.access_token, function (error, teamIdentity) {
                            if (!error) {
                                team = {
                                    id: teamIdentity.team_id,
                                    url: teamIdentity.url,
                                    created_by: teamIdentity.user_id,
                                    name: teamIdentity.team
                                };
                                if (typeof auth.incoming_webhook !== "undefined") {
                                    team.incoming_web_hook = {
                                        token: auth.access_token,
                                        createdBy: teamIdentity.user_id,
                                        url: auth.incoming_webhook.url,
                                        channel: auth.incoming_webhook.channel,
                                        configuration_url: auth.incoming_webhook.configuration_url
                                    };
                                }
                                if (typeof auth.bot !== "undefined") {
                                    team.bot = {
                                        user_id: auth.bot.bot_user_id,
                                        access_token: auth.bot.bot_access_token,
                                        created_by: teamIdentity.user_id,
                                        app_token: auth.access_token
                                    };
                                }
                                // get bot name by authorizing on its token.
                                testAuth(team.bot.access_token, function (error, value) {
                                    team.bot.name = value.user;
                                });
                                user = {
                                    id: teamIdentity.user_id,
                                    user: teamIdentity.user,
                                    team_id: teamIdentity.team_id,
                                    scopes: auth.scope.split(/\,/),
                                    access_token: auth.access_token
                                };
                                _this.userEmitter.emit('user', user);
                                _this.teamEmitter.emit('team', team);
                            }
                            else {
                                isError = true;
                            }
                        });
                    }
                    if (isError) {
                        res.status(500).send("Auth error.");
                    }
                    else {
                        res.redirect('/');
                    }
                });
            }
        });
    };
    Rusty.prototype.__initializeEventsAndSlashCommands = function (webProps) {
        var _this = this;
        var end_point = "/event";
        if (typeof webProps.end_point !== 'undefined') {
            end_point = webProps.end_point;
        }
        if (typeof webProps.tokens !== "undefined" && webProps.tokens.length > 0) {
            this.__secureEventsAndSlashCommands(end_point, webProps.tokens);
        }
        this.app.post(end_point, function (req, res) {
            // interactive_message get body as string. command or event callback as json :S
            var body = req.body;
            if (typeof body === 'string') {
                body = JSON.parse(body);
            }
            // some other times, all message stuff comes in a string payload...
            if (typeof body.payload !== 'undefined' && typeof body.payload === 'string') {
                body = JSON.parse(body.payload);
            }
            if (body.type === "url_verification") {
                // challenge. respond with back with it
                res.contentType("text/plain");
                res.send(body.challenge);
            }
            else {
                console.log(body);
                if (typeof body.command !== "undefined") {
                    // slash commands
                    _this.__handleSlashCommand(body, res);
                }
                else if (body.type === 'event_callback') {
                    // events
                    _this.__handleEvent(body, res);
                }
                else if (body.type === 'interactive_message') {
                    // interactive events
                    _this.__handleInteractiveEvent(body, res);
                }
                else {
                    // } else if (req.body.type==='message_callback') {
                    //     // message callback
                    //     this.__handleMessageCallback(req.body, res );
                    // } else {
                    _this.__handleUnknown(body, res);
                }
            }
        });
    };
    Rusty.prototype.__handleUnknown = function (body, eres) {
        console.log('unknown', body);
        eres.status(200).send('');
    };
    Rusty.prototype.__handleInteractiveEvent = function (body, eres) {
        var user_id = body.user.id;
        var team_id = body.team.id;
        var callback_id = body.callback_id;
        // normalize
        body.channel_id = body.channel.id;
        var team = this.storage.getTeam(team_id);
        // build user out of message info.
        var user = {
            id: body.user.id,
            user: body.user.name,
            team_id: body.team.id,
            access_token: team.bot.app_token,
            scopes: ['']
        };
        try {
            var ch = interactiveMap[user_id][callback_id];
            if (typeof ch !== 'undefined') {
                if (typeof team === 'undefined') {
                    console.info("interactive event for unknown team " + body.team.id + ".");
                }
                else {
                    var ic = new ConversationHelper_1.InteractiveConversationHelper(this, user, team, eres, body, callback_id);
                    ch(ic, body.actions);
                    // might not be executed.
                    ic.__respond(200, '');
                    return;
                }
            }
        }
        catch (e) {
            // eat error of accessing interactiveMap[user_id][callback_id]
        }
        console.error('unknown interactive message', body);
        eres.status(200).send('');
        var msg = new ConversationHelper_1.ConversationHelper(this, user, team, eres, body);
        msg.reply("This conversation branch has ended before.", undefined, true);
    };
    Rusty.prototype.__handleMessageCallback = function (body, eres) {
        console.log('message callback', body);
        eres.status(200).send('');
    };
    Rusty.prototype.__secureEventsAndSlashCommands = function (end_point, tokens) {
        this.app.use(end_point, function authenticate(req, res, next) {
            var token = null;
            // find an auth token.
            if (req.body) {
                if (typeof req.body.token !== "undefined") {
                    token = req.body.token;
                }
                else if (typeof req.body.payload !== "undefined") {
                    var payload = req.body.payload;
                    if (typeof payload === 'string') {
                        payload = JSON.parse(payload);
                    }
                    token = payload.token;
                }
            }
            if (null === token || tokens.indexOf(token) === -1) {
                res.status(401).send({
                    'code': 401,
                    'message': 'Unauthorized'
                });
                return;
            }
            next();
        });
    };
    Rusty.prototype.__handleEvent = function (body, eres) {
        var _this = this;
        // ok, event started.
        eres.status(200).send('');
        var event = body.event.type;
        var text = body.event.text;
        // normalize expected info.
        body.channel_id = body.event.channel;
        var eventPatterns = this.events[event];
        if (typeof eventPatterns !== 'undefined') {
            var user_1 = this.storage.getUser(body.event.user);
            var team_1 = this.storage.getTeam(body.team_id);
            eventPatterns.forEach(function (pattern) {
                var res = pattern.re.exec(text);
                if (res !== null && res.length >= 1) {
                    var hc = new ConversationHelper_1.ConversationHelper(_this, user_1, team_1, eres, body);
                    pattern.callback(hc, text, {
                        matches: res,
                        message: text
                    });
                }
            });
        }
    };
    Rusty.prototype.__handleSlashCommand = function (body, res) {
        var commandCallback = this.slashCommands[body.command];
        if (typeof commandCallback !== 'undefined') {
            var user = this.storage.getUser(body.user_id);
            var team = this.storage.getTeam(body.team_id);
            var hc = new ConversationHelper_1.ConversationHelper(this, user, team, res, body);
            commandCallback(hc, body.command, body.text);
            hc.__respond(200, '');
        }
        else {
            res.status(500).send("unknown slash command " + body.command);
        }
    };
    Rusty.prototype.onSlashCommand = function (commands_, callback) {
        var _this = this;
        var commands;
        if (typeof commands_ === 'string') {
            commands = [commands_];
        }
        else {
            commands = commands_;
        }
        commands.forEach(function (command) {
            _this.slashCommands[command] = callback;
        });
        return this;
    };
    Rusty.prototype.onEvent = function (hear_, events_, callback) {
        var _this = this;
        var events;
        if (typeof events_ === 'string') {
            events = events_.split(',');
        }
        else {
            events = events_;
        }
        // hear are supposed to be regular expressions.
        var hear;
        if (typeof hear_ === 'string') {
            hear = [hear_];
        }
        else {
            hear = hear_;
        }
        events.forEach(function (event) {
            var ev_array = _this.events[event];
            if (typeof ev_array === 'undefined') {
                ev_array = [];
                _this.events[event] = ev_array;
            }
            hear.forEach(function (h) {
                var re = new RegExp(h);
                ev_array.push({
                    pattern: h,
                    re: re,
                    callback: callback
                });
            });
        });
        return this;
    };
    Rusty.prototype.__registerInteractiveRequest = function (user_id, callback_id, ts, callback) {
        var user = interactiveMap[user_id];
        if (typeof user === 'undefined') {
            user = {};
            interactiveMap[user_id] = user;
        }
        user[callback_id] = callback;
    };
    Rusty.prototype.__unregisterInteractiveRequest = function (user_id, callback_id) {
        try {
            var ip = interactiveMap[user_id][callback_id];
            interactiveMap[user_id][callback_id] = undefined;
        }
        catch (e) {
            console.error("Error unregistering interactive request for " + user_id + ", " + callback_id + ".");
        }
        return '';
    };
    return Rusty;
}());
exports.default = Rusty;
//# sourceMappingURL=Rusty.js.map