"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var request = require("request");
function slackAPI(params, callback) {
    params.url = 'https://slack.com/api/' + params.url;
    clientAPI(params, callback);
}
exports.slackAPI = slackAPI;
function clientAPI(params, callback) {
    request(params, function (error, response, body) {
        if (response.statusCode === 200) {
            try {
                callback(null, JSON.parse(body));
            }
            catch (e) {
                callback(null, body);
            }
        }
        else {
            callback(error, null);
        }
    });
}
exports.clientAPI = clientAPI;
//# sourceMappingURL=api.js.map