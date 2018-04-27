/**
 * Bot handler does the dirty lifting with bot providers.
 * Sets oauth and events endpoints
 *
 */

import express = require("express");
import {ConversationHelper, InteractiveConversationHelper} from "./ConversationHelper";
import {Team, TeamIncomingWebHook} from "./storage/Team";
import {User} from "./storage/User";
import {APICallback, slackAPI} from "./api";
import Storage from "./storage/Storage";

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

export interface HearInfo {
    message : string;           // original message
    matches : string[];         // reg exp matched info.
}

export type SlashCommandCallback = (ch:ConversationHelper, command:string, text:string) => void;

export type EventCallback = (ch:ConversationHelper, heard: HearInfo ) => void;

export interface InteractiveAction {
    name : string;
    type : string;  // button | menu
    value: string;
}

export type InteractiveCallback = (ch:InteractiveConversationHelper, responses:InteractiveAction[] ) => void;

function testAuth<T>( auth_token : string, callback : APICallback<T> ) {

    slackAPI<T>(
        {
            url : 'auth.test',
            form: {
                token: auth_token
            },
            method: 'POST'
        },
        callback );
}

type InteractiveRequestMap = {[key:string]:InteractiveCallback};
type UserInteractiveRequestMap = {[key:string]:InteractiveRequestMap};

interface EventPattern {
    re      : RegExp;
    callback: EventCallback;
    pattern : string;
}

let interactiveMap : UserInteractiveRequestMap = {};

export type AuthCallback = ( user:User, team:Team ) => void;

export default class Rusty {

    private app : express.Express;

    private storage : Storage;
    private slashCommands : {[key:string]:SlashCommandCallback} = {};
    private events : {[key:string]:EventPattern[]} = {};

    private authObservers : AuthCallback[] = [];

    constructor( storage : Storage ) {
        this.storage= storage;
    }

    installForWebServer( app: express.Express, props: HandlerProperties ) {
        this.app = app;

        this.__initializeOAuth( props.OAuth );
        this.__initializeEventsAndSlashCommands( props.Web );

        return this;
    }

    onAuthorization( cb : AuthCallback ) : Rusty {
        this.authObservers.push(cb);
        return this;
    }

    removeAuthorizationObserver( cb: AuthCallback ) {
        const index = this.authObservers.indexOf(cb);
        if ( index!==-1 ) {
            this.authObservers.splice(index, 1);
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

                slackAPI<OAuthResponse>(
                    {
                        url     : 'oauth.access',
                        form    : {
                            code            : req.query.code,
                            client_id       : oauthProps.client_id,
                            client_secret   : oauthProps.client_secret
                        },
                        method  : 'POST'
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
                                        name : teamIdentity.team,
                                        scopes : auth.scope.split(/\,/),
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

                                        user = {
                                            id : teamIdentity.user_id,
                                            user : teamIdentity.user,
                                            team_id : teamIdentity.team_id,
                                            access_token : auth.access_token
                                        };

                                        this.__emitAuth( user, team );
                                    });


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

    __emitAuth(user: User, team: Team) {
        this.authObservers.forEach( ao => {
            ao(user, team);
        })
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

        const team= this.storage.getTeam(team_id);
        // build user out of message info.
        let user = {
            id: body.user.id,
            user: body.user.name,
            team_id: body.team.id,
            access_token: team.bot.app_token,
            scopes: ['']
        };

        try {
            const ch = interactiveMap[user_id][callback_id];

            if ( typeof ch!=='undefined' ) {
                if ( typeof team==='undefined' ) {
                    console.info(`interactive event for unknown team ${body.team.id}.`);
                } else {

                    const ic = new InteractiveConversationHelper(this, user, team, eres, body, callback_id);
                    ch(ic, body.actions );

                    // might not be executed.
                    ic.__respond(200,'');

                    return;
                }
            }
        } catch(e) {
            // eat error of accessing interactiveMap[user_id][callback_id]
        }

        console.error('unknown interactive message', body);
        eres.status(200).send('');
        const msg = new ConversationHelper(this, user, team, eres, body);
        msg.reply(
            `This conversation branch has ended before.`,
            undefined,
            true);
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

        // ok, event started.
        eres.status(200).send('');

        const event = body.event.type as string;
        const text = body.event.text as string;

        // normalize expected info.
        body.channel_id = body.event.channel;

        const eventPatterns = this.events[event];
        if ( typeof eventPatterns!=='undefined' ) {

            const team= this.storage.getTeam(body.team_id);
            let user : User = this.storage.getUser(body.event.user);
            // user not in db.
            // create a user descriptor.
            if ( user===null ) {
                user= {
                    id : body.event.user,
                    user : '',
                    access_token : body.token,
                    team_id : body.team_id
                };

                // could check users.identity to get user.name !!
            }

            eventPatterns.forEach( pattern => {

                const res= pattern.re.exec( text );
                if ( res!==null && res.length>=1 ) {
                    const hc = new ConversationHelper(this, user, team, eres, body );
                    pattern.callback(
                        hc,
                        {
                            matches : res,
                            message : text
                        });
                }
            });
        }
    }

    __handleSlashCommand( body : any, res: express.Response ) {

        const commandCallback = this.slashCommands[body.command];
        if ( typeof commandCallback!=='undefined' ) {

            const team= this.storage.getTeam(body.team_id);
            let user : User = this.storage.getUser(body.user_id);

            // user not in db.
            // create a user descriptor.
            if ( user===null ) {
                user= {
                    id : body.user_id,
                    user : body.user_name,
                    access_token : body.token,
                    team_id : body.team_id
                }
            }

            const hc = new ConversationHelper(this, user, team ,res, body);
            commandCallback( hc, body.command, body.text );
            hc.__respond(200,'');
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

    __registerInteractiveRequest( user_id : string, callback_id : string, ts : string, callback:InteractiveCallback ) {

        let user = interactiveMap[user_id];
        if ( typeof user==='undefined' ) {
            user= {};
            interactiveMap[user_id] = user;
        }

        user[callback_id] = callback;
    }

    __unregisterInteractiveRequest( user_id: string, callback_id: string ) {
        try {
            const ip = interactiveMap[user_id][callback_id];
            interactiveMap[user_id][callback_id] = undefined;
        } catch(e) {
            console.error(`Error unregistering interactive request for ${user_id}, ${callback_id}.`)
        }

        return '';
    }
}
