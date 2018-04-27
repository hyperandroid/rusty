
import request = require("request");

export type APICallback<T> = (error:Error, data:T) => void;

export type APIHeaders = {[key:string]:string};

export interface APIParams {
    form? : any;
    json? : any;
    method : string;
    headers? : APIHeaders;
    url : string;
}

export function slackAPI<T>( params:APIParams, callback : APICallback<T>) {
    params.url = 'https://slack.com/api/' + params.url;
    clientAPI<T>( params, callback );
}

export function clientAPI<T>( params:APIParams, callback : APICallback<T>) {
    request(
        params,
        function (error: any, response: request.Response, body: any) {
            if (response.statusCode === 200) {
                try {
                    callback(null, JSON.parse(body) as T);
                } catch(e) {
                    callback(null, body);
                }
            } else {
                callback( error, null );
            }
        });
}
