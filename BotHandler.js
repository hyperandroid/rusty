"use strict";
/**
 * Bot handler does the dirty lifting with bot providers.
 * Sets oauth and events endpoints
 *
 * bugbug: It uses an Express server instance.
 */
Object.defineProperty(exports, "__esModule", { value: true });
var request = require("request");
var ConversationHelper_1 = require("./ConversationHelper");
var fs = require("fs");
function clientAPI(endPoint, params, callback) {
    request({
        url: 'https://slack.com/api/' + endPoint,
        form: params.form,
        method: params.method
    }, function (error, response, body) {
        if (response.statusCode === 200) {
            callback(null, JSON.parse(body));
        }
        else {
            callback(error, null);
        }
    });
}
function testAuth(auth_token, callback) {
    clientAPI('auth.test', {
        form: {
            token: auth_token
        },
        method: 'POST'
    }, callback);
}
var usersMap = {};
var teamsMap = {};
var BotHandler = (function () {
    function BotHandler() {
        this.slashCommands = {};
        this.events = {};
        this.__loadCredentials();
    }
    BotHandler.prototype.installForWebServer = function (app, props) {
        this.app = app;
        this.__initializeOAuth(props.OAuth);
        this.__initializeEventsAndSlashCommands(props.Web);
        return this;
    };
    BotHandler.prototype.__saveCredentials = function () {
        fs.writeFileSync(__dirname + "/users.json", JSON.stringify(usersMap, null, 2));
        fs.writeFileSync(__dirname + "/teams.json", JSON.stringify(teamsMap, null, 2));
    };
    BotHandler.prototype.__loadCredentials = function () {
        try {
            var um = JSON.parse(fs.readFileSync(__dirname + "/users.json").toString());
            usersMap = um;
        }
        catch (e) {
            console.info("Can't read users file.");
        }
        try {
            var tm = JSON.parse(fs.readFileSync(__dirname + "/teams.json").toString());
            teamsMap = tm;
        }
        catch (e) {
            console.info("Can't read teams file.");
        }
    };
    BotHandler.prototype.__initializeOAuth = function (oauthProps) {
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
                clientAPI('oauth.access', {
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
                                usersMap[user.id] = user;
                                teamsMap[team.id] = team;
                                _this.__saveCredentials();
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
    BotHandler.prototype.__initializeEventsAndSlashCommands = function (webProps) {
        var _this = this;
        var end_point = "/event";
        if (typeof webProps.end_point !== 'undefined') {
            end_point = webProps.end_point;
        }
        if (typeof webProps.tokens !== "undefined" && webProps.tokens.length > 0) {
            this.__secureEventsAndSlashCommands(end_point, webProps.tokens);
        }
        this.app.post(end_point, function (req, res) {
            if (req.body.type === "url_verification") {
                // challenge. respond with back with it
                res.contentType("text/plain");
                res.send(req.body.challenge);
            }
            else {
                if (typeof req.body.command !== "undefined") {
                    // slash commands
                    _this.__handleSlashCommand(req.body, res);
                }
                else if (req.body.type === 'event_callback') {
                    // events
                    _this.__handleEvent(req.body, res);
                }
                else {
                    //     if (typeof req.body.callback_id!=='undefined') {
                    //     // interactive events
                    //     this.__handleInteractiveEvent(req.body, res );
                    // } else if (req.body.type==='message_callback') {
                    //     // message callback
                    //     this.__handleMessageCallback(req.body, res );
                    // } else {
                    _this.__handleUnknown(req.body, res);
                }
            }
        });
    };
    BotHandler.prototype.__handleUnknown = function (body, eres) {
        console.log('unknown', body);
        eres.status(200).send('');
    };
    BotHandler.prototype.__handleInteractiveEvent = function (body, eres) {
        console.log('interactive message', body);
        eres.status(200).send('');
    };
    BotHandler.prototype.__handleMessageCallback = function (body, eres) {
        console.log('message callback', body);
        eres.status(200).send('');
    };
    BotHandler.prototype.__secureEventsAndSlashCommands = function (end_point, tokens) {
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
    BotHandler.prototype.__handleEvent = function (body, eres) {
        var _this = this;
        var event = body.event.type;
        var text = body.event.text;
        // normalize expected info.
        body.channel_id = body.event.channel;
        var eventPatterns = this.events[event];
        if (typeof eventPatterns !== 'undefined') {
            var user_1 = usersMap[body.user_id];
            var team_1 = teamsMap[body.team_id];
            eventPatterns.forEach(function (pattern) {
                var res = pattern.re.exec(text);
                if (res !== null && res.length > 1) {
                    pattern.callback(new ConversationHelper_1.ConversationHelper(_this, user_1, team_1, eres, body), text, {
                        matches: res,
                        message: text
                    });
                }
            });
        }
        else {
            eres.status(200).send('');
        }
    };
    BotHandler.prototype.__handleSlashCommand = function (body, res) {
        var commandCallback = this.slashCommands[body.command];
        if (typeof commandCallback !== 'undefined') {
            var user = usersMap[body.user_id];
            var team = teamsMap[body.team_id];
            commandCallback(new ConversationHelper_1.ConversationHelper(this, user, team, res, body), body.command, body.text);
        }
        else {
            res.status(500).send("unknown slash command " + body.command);
        }
    };
    BotHandler.prototype.onSlashCommand = function (commands_, callback) {
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
    BotHandler.prototype.onEvent = function (hear_, events_, callback) {
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
            _this.events[event] = [];
            hear.forEach(function (h) {
                var re = new RegExp(h);
                _this.events[event].push({
                    pattern: h,
                    re: re,
                    callback: callback
                });
            });
        });
        return this;
    };
    return BotHandler;
}());
exports.default = BotHandler;
//# sourceMappingURL=BotHandler.js.map