
import request = require("request");

export type APICallback<T> = (error:Error, data:T) => void;

export interface APIParams {
    form : any;
    method : string;
}

export function clientAPI<T>( endPoint:string, params:APIParams, callback : APICallback<T>) {

    request(
        {
            url: 'https://slack.com/api/' + endPoint,
            form: params.form,
            method: params.method
        },
        function (error: any, response: request.Response, body: any) {
            if (response.statusCode === 200) {
                callback( null, JSON.parse(body) as T);
            } else {
                callback( error, null );
            }
        });
}
