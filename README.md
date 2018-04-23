# Rusty

A minimalistic slack bot (currently only a WebBot).

Rusty relies on Express to set bot end points.

## Simplest example

The simplest example could be echoing information received by a predefined slash command.

`app` is an express instance and `credentials` valid Slack Application credentials (see configuration for more info).

```
// create an Express server
var express = require("express");
var bodyParser = require("body-parser");
var Rusty = require("../Rusty");

const app = express();
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.listen(8123, function () {
    console.log("App listening on port " + PORT);
});

// create a Rusty instance.
const bh = new Rusty()
    .installForWebServer(app, credentials)
    .onSlashCommand(
        '/slang',
        (ch:ConversationHelper, command:string, text:string) => {
            if (command==='/slang' ) {
            
                // just echo back as a message what we got.
                ch.reply(text);
            }
        });
```

## Configuration

The system configuration comes from a json file of the form:

```
{
  "OAuth": {
    "client_id": "xxxxxxxxxxxx.xxxxxxxxxxxx",
    "client_secret": "01234567890123456789012345678901"
    "end_point" : "An optional express app route. Defaults to /oauth"
  },
  "Web": {
    "tokens": [
      "tokentokentokentokentoke"
    ],
    "end_point" : "An optional express app route. Defaults to /event"
  }
}
```

`client_id` and `client_secret` and `tokens` are values found in your slack app's Basic Information page.

Rusty can handle several application tokens. When using the Web API these tokens are received with each http request.
To verify the request is legit and coming from Slack, Rusty automatically checks the supplied token with the supplied
ones. If they don't match, we can 100% be sure the request is forged and not coming from Slack so it is safely
discarded. 

Internally, Rusty sets a transparent Express middleware filter which will return a `401 unauthorized` response
if tokens are not valid. 

All web requests received by Rusty, either `WebHooks`, `Events` or `Slash commands` will be handled by Configuration's
`Web` endpoint.

## Application install

Each time a Slack team installs your bot, the configuration endpoint defined in `Oauth` will be invoked with a GET
request. The query string will receive a temporarily generated `code` parameter which must be authorized by your
app.

`Rusty`'s `__initializeOAuth` method takes care of this by POST to `oauth.access` with your configuration supplied 
`client_id`, `client_secret` and the received `code` parameter. As a result, Rusty will generate a `Team`, for
the slack workspace authorizing the app, and a `User` for the user in that workspace authorizing the app.
It is important you keep these two safe since they contain sensitive auth codes to interact with your bot.

These data is insecurely handled by the `Store` object, which just saves it to a file. 