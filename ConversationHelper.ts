import BotHandler, {InteractiveAction, InteractiveCallback} from "./Rusty";
import express = require("express");
import request = require("request");
import process = require('process');
import {Team} from "./storage/Team";
import {User} from "./storage/User";

export interface AttachmentField {
    title? : string;
    value? : string;
    short? : boolean;
}

export interface AttachmentAction {
    type : string;
    text : string;
    url? : string;
    style? : string;
    value? : string;
    name? : string;
}

/**
 * See https://api.slack.com/docs/message-attachments
 */
export interface Attachment {

    callback_id? : string;
    attachment_type? : string;

    fallback: string;

    color? : string;        // #RRGGBB

    title? : string;
    title_link? : string;

    pretext?: string;
    text?: string;

    mrkdwn_in? : string[];

    author_name? : string;
    author_link? : string;
    author_icon? : string;

    image_url? : string;
    thumb_url? : string;

    footer? : string;
    footer_icon? : string;

    ts? : number;

    fields? : AttachmentField[];

    actions? : AttachmentAction[];  // if defining actions, must define fallback
}

export type InteractiveCallbackMap = {[key:string]:InteractiveCallback}

export interface InteractiveOptions {
    ephemeral : boolean;
    attachments : Attachment[];
    on : InteractiveCallbackMap;
}

export class ConversationHelper {

    protected bh : BotHandler;
    protected response : express.Response;
    protected body : any;

    protected team : Team;
    protected user : User;

    protected responded : boolean= false;

    constructor( bh : BotHandler, user:User, team:Team, response: express.Response, body:any ) {
        this.bh = bh;
        this.response = response;
        this.body = body;
        this.user = user;
        this.team = team;
    }

    reply( message:string, attachments_? : Attachment|Attachment[], ephemeral?:boolean, callback?:(body:any)=>void ) {

        const channel = this.body.channel_id;
        const token = this.team.bot.app_token;

        let endPoint = 'chat.postMessage';
        if ( ephemeral ) {
            endPoint = 'chat.postEphemeral';
        }

        let attachments : Attachment[]= [];
        if (typeof attachments_!=='undefined' ) {
            if (Array.isArray(attachments_)) {
                attachments = attachments_ as Attachment[];
            } else {
                attachments = [attachments_ as Attachment];
            }
        }

        let form : any = {
            token: token,
            channel: channel,
            text: message,
        };

        if ( ephemeral ) {
            form.user = this.user.id;
        }

        if (attachments.length>0 ) {
            form.attachments= JSON.stringify(attachments);
        }

        request
            .post(
                'https://slack.com/api/' + endPoint,
                {
                    headers: {
                        'content-type': 'application/json; charset=utf-8'
                    },
                    form: form
                },
                (error: Error, response: request.Response, body_: any) => {
                    const body = JSON.parse(body_);

                    if ( typeof callback!=='undefined' ) {
                        callback(body);
                    }

                    if (error || response.statusCode !== 200 || body.ok === false) {
                        console.log(error, body);
                    }
                });
    }

    /**
     * Send a message to registered channel incoming webhook.
     *
     *
     * @param {string} message
     * @param {Attachment[]} attachments optional attachment collection.
     */
    sendToIncomingWebHook( message:string, attachments?:Attachment[] ) {

        let url = '';
        try {
            url= this.team.incoming_web_hook.url;
        } catch(e) {
            console.error(`Can't find a team, or team w/o web hook info.`);
            return;
        }

        request({
            method: "POST",
            url: url,
            headers: {'content-type': 'application/json'},
            json: {
                text: message,
                attachments : (typeof attachments!=='undefined' ? attachments : [])
            }
        }, function (error, response, body) {
            if (error) {
                console.log(error);
            }
        });
    }

    /**
     * Interactive calls, don't need to be ack'ed.
     *
     *
     * @param {InteractiveOptions} options
     */
    interactive( options:InteractiveOptions ) {

        let callback_id = '';
        options.attachments.forEach( attachment => {
            if ( typeof attachment.callback_id!=='undefined' ) {
                callback_id = attachment.callback_id;
            }
        });

        if ( callback_id!=='' ) {

            this.reply(
                '',
                options.attachments,
                options.ephemeral,
                (body:any) => {

                    let ts= '';
                    try {
                        ts= body.event.ts ;    // para update, el timestamp del mensaje a modificar es este.
                    } catch(e) {
                        ts = body.message_ts;
                    }

                    console.log(`received reply to interactive ${JSON.stringify(body)}`);

                    // on reply callback, take message ts identifier to make responses.
                    this.bh.__registerInteractiveRequest(
                        this.user.id,
                        callback_id,
                        ts,
                        (hc:InteractiveConversationHelper, actions:InteractiveAction[]) => {

                            actions.forEach( action => {

                                let on_callback = options.on[action.value];

                                if (typeof on_callback==='undefined') {
                                    on_callback = options.on['id_default']
                                }

                                if (typeof on_callback!=='undefined') {
                                    on_callback(hc, actions);
                                } else {
                                    //
                                    console.info(`UUID:${callback_id} interactive action ${action.value} w/o handler.`);
                                }
                            });

                        });

            });
        } else
            console.error('Interactive w/o callback_id on attachments.');

    }

    __respond( code:number, message:any ) {
        if ( this.responded ) {
            return;
        }
        this.response.status(code).send(message);
        this.responded= true;
    }
}

export class InteractiveConversationHelper extends ConversationHelper {

    protected callback_id : string;
    protected response_url : string;

    constructor( bh : BotHandler, user:User, team:Team, response: express.Response, body:any, callback_id:string ) {
        super(bh, user, team, response, body);
        this.callback_id = callback_id;
        this.response_url = body.response_url;
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
    setReply(attachments : string|Attachment[], ephemeral:boolean, replaceOriginal:boolean ) {
        const ts = this.bh.__unregisterInteractiveRequest( this.user.id, this.callback_id );

        console.log('updating message : '+ts);

        if ( typeof attachments!=='undefined' ) {

            let res : any = {
                replace_original: replaceOriginal,
            };

            if (typeof attachments==='string') {
                res.text = attachments;
            } else {
                res.attachments= attachments;
            }

            if (ephemeral) {
                res.response_type= "ephemeral";
            }

            this.__respond(200, res);
        }
    }
}