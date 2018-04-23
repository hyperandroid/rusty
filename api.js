"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var request = require("request");
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
exports.clientAPI = clientAPI;
//# sourceMappingURL=api.js.map