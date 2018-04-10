import BotHandler, {Team, User} from "./BotHandler";
import express = require("express");
import request = require("request");

export interface AttachmentField {
    title? : string;
    value? : string;
    short? : boolean;
}

export interface AttachmentAction {
    type : string;
    text : string;
    url : string;
    style? : string;
}

/**
 * See https://api.slack.com/docs/message-attachments
 */
export interface Attachment {
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

export class ConversationHelper {

    private bh : BotHandler;
    private response : express.Response;
    private body : any;

    private team : Team;
    private user : User;

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

        if (attachments.length>0 ) {
            form.attachments= JSON.stringify(attachments);
        }

        request
            .get('https://slack.com/api/' + endPoint,
                {
                    headers: {
                        'content-type': 'application/json; charset=utf-8'
                    },
                    qs: form
                },
                (error: Error, response: request.Response, body_: any) => {
                    const body = JSON.parse(body_);
                    if (error || response.statusCode !== 200 || body.ok === false) {
                        console.log(error, body);
                    }
                });

        this.response.status(200).send('');
    }

    sendToIncomingWebHook( message:string ) {

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
            }
        }, function (error, response, body) {
            if (error) {
                console.log(error);
            }
        });
    }

    addReaction() {

    }

    startConversation( ) {

    }
}