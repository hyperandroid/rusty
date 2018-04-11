/**
 * Bot handler does the dirty lifting with bot providers.
 * Sets oauth and events endpoints
 *
 * bugbug: It uses an Express server instance.
 */

import express = require("express");
import request = require("request");
import {ConversationHelper, InteractiveConversationHelper} from "./ConversationHelper";
import fs = require("fs");

export interface OAuthProperties {
    client_id       : string;
    client_secret   : string;
    end_point?      : string;
}

export interface WebAuthProperties {
    tokens      : string[];
    end_point?  : string;
}

export interface HandlerProperties {
    OAuth : OAuthProperties;
    Web : WebAuthProperties;
}

export interface Bot {
    access_token: string;
    user_id: string;
    created_by: string;
    app_token: string;
    name?: string;      // bot name.
}

export interface Team {
    id : string;
    name : string;
    created_by : string;
    url : string;
    bot? : Bot;
    incoming_web_hook? : TeamIncomingWebHook;
}

export interface TeamIncomingWebHook {
    token : string;
    createdBy : string;
    url : string;
    channel : string;
    configuration_url : string;
}

export interface User {
    id : string;
    team_id : string;
    user: string;
    access_token : string;
    scopes : string[];
}


interface IncomingWebHookAuthResponse {
    url                 : string;
    channel             : string;
    channel_id          : string;
    configuration_url   : string;
}

interface OAuthResponse {
    ok                  : boolean;
    access_token        : string;
    scope               : string;
    team_name           : string;
    team_id?            : string;
    incoming_webhook?   : IncomingWebHookAuthResponse;
    commands            : any;
    bot?                : BotAuthResponse;
}

interface OAuthTeamIdentity {
    ok      : boolean;
    team_id : string;
    user    : string;
    user_id : string;
    url     : string;
    team    : string;
    bot?    : {
        bot_access_token : string;
        bot_user_id      : string;
    }
}

interface OAuthBotIdentity {
    user : string;
}

interface BotAuthResponse {
    bot_access_token: string;
    bot_user_id     : string;
}

interface APIParams {
    form : any;
    method : string;
}

export interface HearInfo {
    message : string;           // original message
    matches : string[];         // reg exp matched info.
}

export type APICallback<T> = (error:Error, data:T) => void;

export type SlashCommandCallback = (ch:ConversationHelper, command:string, text:string) => void;

export type EventCallback = (ch:ConversationHelper, event:string, heard: HearInfo ) => void;

export interface InteractiveAction {
    name : string;
    type : string;  // button | menu
    value: string;
}

export type InteractiveCallback = (ch:ConversationHelper, responses:InteractiveAction[] ) => void;

function clientAPI<T>( endPoint:string, params:APIParams, callback : APICallback<T>) {

    request(
        {
            url: 'https://slack.com/api/' + endPoint,
            form: params.form,
            method: params.method
        }, function (error: any, response: request.Response, body: any) {
            if (response.statusCode === 200) {
                callback( null, JSON.parse(body) as T);
            } else {
                callback( error, null );
            }
        });
}

function testAuth<T>( auth_token : string, callback : APICallback<T> ) {

    clientAPI<T>(
        'auth.test',
        {
            form: {
                token: auth_token
            },
            method: 'POST'
        },
        callback );
}

type TeamsMap = {[key:string]:Team};
type UserMap = {[key:string]:User};

type InteractiveRequestMap = {[key:string]:InteractiveCallback};
type UserInteractiveRequestMap = {[key:string]:InteractiveRequestMap};

interface EventPattern {
    re      : RegExp;
    callback: EventCallback;
    pattern : string;
}

let usersMap : UserMap = {};
let teamsMap : TeamsMap = {};
let interactiveMap : UserInteractiveRequestMap = {};

export default class BotHandler {

    private app : express.Express;

    private slashCommands : {[key:string]:SlashCommandCallback} = {};
    private events : {[key:string]:EventPattern[]} = {};

    constructor() {
        this.__loadCredentials();
    }

    installForWebServer( app: express.Express, props: HandlerProperties ) {
        this.app = app;

        this.__initializeOAuth( props.OAuth );
        this.__initializeEventsAndSlashCommands( props.Web );

        return this;
    }

    __saveCredentials() {
        fs.writeFileSync( __dirname+"/users.json", JSON.stringify(usersMap,null,2) );
        fs.writeFileSync( __dirname+"/teams.json", JSON.stringify(teamsMap,null,2) );
    }

    __loadCredentials() {
        try {
            const um = JSON.parse(fs.readFileSync(__dirname + "/users.json").toString());
            usersMap = um as UserMap;
        } catch(e) {
            console.info("Can't read users file.");
        }

        try {
            const tm = JSON.parse( fs.readFileSync( __dirname+"/teams.json" ).toString());
            teamsMap =tm as TeamsMap;
        } catch(e) {
            console.info("Can't read teams file.");
        }
    }

    __initializeOAuth( oauthProps : OAuthProperties ) {

        let end_point = "/oauth";
        if ( typeof oauthProps.end_point!=='undefined' ) {
            end_point = oauthProps.end_point;
        }

        this.app.get(end_point, (req : express.Request, res : express.Response ) => {

            let team : Team;
            let user : User;

            if (!req.query.code) {
                res.status(500).send({"Error": "Looks like we're not getting code."});
                console.error("Error in bot oauth.");
            } else {

                clientAPI<OAuthResponse>(
                    'oauth.access',
                    {
                        form : {
                            code            : req.query.code,
                            client_id       : oauthProps.client_id,
                            client_secret   : oauthProps.client_secret
                        },
                        method : 'POST'
                    },
                    (error: Error, auth: OAuthResponse) => {

                        let isError = true;

                        if (!error && auth.ok===true) {

                            isError = false;

                            // test authorization token.
                            // also reliably get team_id
                            testAuth(auth.access_token, (error: Error, teamIdentity: OAuthTeamIdentity) => {

                                if (!error) {
                                    team = {
                                        id : teamIdentity.team_id,
                                        url: teamIdentity.url,
                                        created_by : teamIdentity.user_id,
                                        name : teamIdentity.team
                                    };

                                    if ( typeof auth.incoming_webhook!=="undefined" ) {
                                        team.incoming_web_hook = {
                                            token : auth.access_token,
                                            createdBy : teamIdentity.user_id,
                                            url : auth.incoming_webhook.url,
                                            channel : auth.incoming_webhook.channel,
                                            configuration_url : auth.incoming_webhook.configuration_url
                                        } as TeamIncomingWebHook;
                                    }

                                    if ( typeof auth.bot!=="undefined" ) {
                                        team.bot = {
                                            user_id : auth.bot.bot_user_id,
                                            access_token : auth.bot.bot_access_token,
                                            created_by : teamIdentity.user_id,
                                            app_token : auth.access_token
                                        }
                                    }

                                    // get bot name by authorizing on its token.
                                    testAuth( team.bot.access_token, (error:Error, value:OAuthBotIdentity) => {
                                        team.bot.name = value.user;
                                    });

                                    user = {
                                        id : teamIdentity.user_id,
                                        user : teamIdentity.user,
                                        team_id : teamIdentity.team_id,
                                        scopes : auth.scope.split(/\,/),
                                        access_token : auth.access_token
                                    };

                                    usersMap[user.id] = user;
                                    teamsMap[team.id] = team;

                                    this.__saveCredentials();

                                } else {
                                    isError = true;
                                }
                            });
                        }

                        if ( isError ) {
                            res.status(500).send("Auth error.");
                        } else {
                            res.redirect('/');
                        }
                    });
            }
        });
    }

    __initializeEventsAndSlashCommands( webProps:WebAuthProperties ) {

        let end_point = "/event";
        if ( typeof webProps.end_point!=='undefined' ) {
            end_point = webProps.end_point;
        }

        if ( typeof webProps.tokens!=="undefined" && webProps.tokens.length>0 ) {
            this.__secureEventsAndSlashCommands(end_point, webProps.tokens);
        }

        this.app.post(end_point, (req:express.Request, res:express.Response) => {

            // interactive_message get body as string. command or event callback as json :S
            let body : any = req.body;
            if ( typeof body==='string' ) {
                body = JSON.parse(body);
            }

            // some other times, all message stuff comes in a string payload...
            if ( typeof body.payload!=='undefined' && typeof body.payload==='string' ) {
                body = JSON.parse(body.payload);
            }

            if (body.type==="url_verification" ) {
                // challenge. respond with back with it
                res.contentType( "text/plain" );
                res.send( body.challenge );
            } else {

                if ( typeof body.command!=="undefined" ) {
                    // slash commands
                    this.__handleSlashCommand( body, res );
                } else if (body.type==='event_callback') {
                    // events
                    this.__handleEvent( body, res );
                } else if (body.type==='interactive_message') {
                    // interactive events
                    this.__handleInteractiveEvent(body, res );
                } else {
                // } else if (req.body.type==='message_callback') {
                //     // message callback
                //     this.__handleMessageCallback(req.body, res );
                // } else {
                    this.__handleUnknown(body, res);
                }
            }
        });
    }

    __handleUnknown( body:any, eres:express.Response ) {
        console.log('unknown', body);
        eres.status(200).send('');
    }

    __handleInteractiveEvent( body:any, eres:express.Response ) {

        const user_id       = body.user.id;
        const team_id       = body.team.id;

        const callback_id   = body.callback_id;

        // normalize
        body.channel_id = body.channel.id;

        try {
            const ch = interactiveMap[user_id][callback_id];

            if ( typeof ch!=='undefined' ) {
                const team= teamsMap[team_id];
                if ( typeof team==='undefined' ) {
                    console.info(`interactive event for unknown team ${body.team.id}.`);
                } else {

                    // build user out of message info.
                    let user = {
                        id: body.user.id,
                        user: body.user.name,
                        team_id: body.team.id,
                        access_token: team.bot.access_token,
                        scopes: ['']
                    };

                    ch(new InteractiveConversationHelper(this, user, team, eres, body, callback_id), body.actions );

                    eres.status(200).send('');

                    return;
                }
            }
        } catch(e) {
            console.error(`error handling interactive event`, body);
        }

        console.error('unknown interactive message', body);
        eres.status(500).send('callback id not known');
    }

    __handleMessageCallback( body:any, eres:express.Response ) {
        console.log('message callback',body);
        eres.status(200).send('');
    }

    __secureEventsAndSlashCommands( end_point: string, tokens:string[] ) {

        this.app.use(end_point, function authenticate(req, res, next) {
            let token = null;

            // find an auth token.
            if ( req.body ) {
                if ( typeof req.body.token!=="undefined" ) {
                    token = req.body.token;
                } else if ( typeof req.body.payload!=="undefined" ) {
                    let payload = req.body.payload;
                    if ( typeof payload==='string' ) {
                        payload = JSON.parse( payload );
                    }

                    token = payload.token;
                }
            }

            if (null===token || tokens.indexOf(token)===-1) {
                res.status(401).send({
                    'code': 401,
                    'message': 'Unauthorized'
                });

                return;
            }

            next();
        });
    }

    __handleEvent( body : any, eres: express.Response ) {

        const event = body.event.type as string;
        const text = body.event.text as string;

        // normalize expected info.
        body.channel_id = body.event.channel;

        const eventPatterns = this.events[event];
        if ( typeof eventPatterns!=='undefined' ) {

            const user= usersMap[body.event.user];
            const team= teamsMap[body.team_id];

            eventPatterns.forEach( pattern => {

                const res= pattern.re.exec( text );
                if ( res!==null && res.length>=1 ) {
                    pattern.callback(
                        new ConversationHelper(this, user, team, eres, body ),
                        text,
                        {
                            matches : res,
                            message : text
                        });
                }
            });

        }

        eres.status(200).send('');
    }

    __handleSlashCommand( body : any, res: express.Response ) {

        const commandCallback = this.slashCommands[body.command];
        if ( typeof commandCallback!=='undefined' ) {

            const user= usersMap[body.user_id];
            const team= teamsMap[body.team_id];

            commandCallback( new ConversationHelper(this, user, team ,res, body), body.command, body.text );
            res.status(200).send('');
        } else {
            res.status(500).send( `unknown slash command ${body.command}` );
        }
    }

    onSlashCommand( commands_:string|string[], callback:SlashCommandCallback ) {
        let commands : string[];
        if ( typeof commands_==='string' ) {
            commands= [commands_ as string];
        } else {
            commands = commands_ as string[];
        }

        commands.forEach( command => {
            this.slashCommands[command] = callback;
        });

        return this;
    }

    onEvent( hear_:string|string[], events_:string|string[], callback:EventCallback ) {

        let events : string[];
        if ( typeof events_==='string' ) {
            events= (events_ as string).split(',');
        } else {
            events = events_ as string[];
        }

        // hear are supposed to be regular expressions.
        let hear : string[];
        if ( typeof hear_==='string' ) {
            hear= [hear_ as string];
        } else {
            hear = hear_ as string[];
        }

        events.forEach( event => {
            let ev_array = this.events[event];
            if ( typeof ev_array==='undefined' ) {
                ev_array= [];
                this.events[event] = ev_array;
            }

            hear.forEach( h=> {
                const re= new RegExp(h);
                ev_array.push({
                    pattern : h,
                    re      : re,
                    callback: callback
                });
            });
        });

        return this;
    }

    registerInteractiveRequest( user_id : string, callback_id : string, callback:InteractiveCallback ) {

        let user = interactiveMap[user_id];
        if ( typeof user==='undefined' ) {
            user= {};
            interactiveMap[user_id] = user;
        }

        user[callback_id] = callback;
    }

    unregisterInteractiveRequest( user_id: string, callback_id: string ) {
        try {
            interactiveMap[user_id][callback_id] = undefined;
        } catch(e) {
            console.error(`Error unregistering interactive request for ${user_id}, ${callback_id}.`)
        }
    }
}
