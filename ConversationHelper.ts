import BotHandler, {InteractiveAction, InteractiveCallback, Team, User} from "./BotHandler";
import express = require("express");
import request = require("request");
import process = require('process');

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

    constructor( bh : BotHandler, user:User, team:Team, response: express.Response, body:any ) {
        this.bh = bh;
        this.response = response;
        this.body = body;
        this.user = user;
        this.team = team;
    }

    reply( message:string, attachments_? : Attachment|Attachment[], ephemeral?:boolean ) {

        const channel = this.body.channel_id;
        const token = this.team.incoming_web_hook.token;

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

    addReaction() {

    }

    /**
     * Interactive calls, don't need to be ack'ed.
     *
     *
     * @param {InteractiveOptions} options
     * @param {Attachment[]} attachments
     * @param {InteractiveCallback} callback
     */
    interactive( options:InteractiveOptions ) {

        let callback_id = '';
        options.attachments.forEach( attachment => {
            if ( typeof attachment.callback_id!=='undefined' ) {
                callback_id = attachment.callback_id;
            }
        });

        if ( callback_id!=='' ) {

            this.bh.registerInteractiveRequest(
                this.user.id,
                callback_id,
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

            this.reply(
                '',
                options.attachments,
                options.ephemeral
            );
        } else
            console.error('Interactive w/o callback_id on attachments.');

    }

    static RandomCallbackUUID() {
        let b= Buffer.alloc(16);
        b.writeDoubleBE( process.hrtime()[1], 0 );
        b.writeDoubleBE( process.hrtime()[1], 8 );
        const hexNum = b.toString('hex');
        const callback_id = hexNum.substr(0, 8) + '-' +
            hexNum.substr(8, 4) + '-' +
            hexNum.substr(12, 4) + '-' +
            hexNum.substr(16, 4) + '-' +
            hexNum.substr(20)

        return callback_id;
    }

}

export class InteractiveConversationHelper extends ConversationHelper {

    protected callback_id : string;

    constructor( bh : BotHandler, user:User, team:Team, response: express.Response, body:any, callback_id:string ) {
        super(bh, user, team, response, body);
        this.callback_id = callback_id;
    }

    finish() {
        this.bh.unregisterInteractiveRequest( this.user.id, this.callback_id );
    }
}