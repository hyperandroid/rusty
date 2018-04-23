# Rusty

A minimalistic slack bot (currently only a WebBot).

Rusty will assist at defining handlers for
+ slash commands
+ events
+ interactive conversations

and also to be able to publish to channels by using web hooks.

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

const storage = new StorageImpl(__dirname+"/..");

// create a Rusty instance.
const bh = new Rusty(storage)
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

We can see 3 elements to have the example working:

+ An express app to be able to respond and secure web requests.
+ An object to keep track of teams and users credentials/tokens
+ A Rusty instance. Rusty will route a convenient object to interact with slack for each registered action type. 

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

## Defining slash commands

First of all, define expected slash command for your slap app in Slack's app `Slash Commands` option.
The supplied `request url` for the command, must match the `end_point` defined in Runsty's `Web` configuration. 

Defining commands is as easy as calling `Rusty` instance's 
`onSlashCommand( commands_: string|string[], callback: SlashCommandCallback )` like:

`rusty.onSlashCommand('slang', (conversation_helper, command, text) => { ... } );`

each time a user types `/slang blah blah`, this callback will be invoked.
You can defined many slash commands for the same callback handler, or chain as much as needed calls to `onSlashCommand` e.g.:

```
    rusty
        .onSlashCommand('slang',  (conversation_helper, command, text) => { ... } )
        .onSlashCommand('slang2', (conversation_helper, command, text) => { ... } )
        .onSlashCommand('slang3', (conversation_helper, command, text) => { ... } );
```

The `conversation_helper` is a convenient object to interact with slack. For example, sending a request back to the
user who invoked the `/slang` slash command would be as easy as:

`conversation_helper.reply('got your text:' + text);`

See [ConversationHelper](##ConsersationHelper) for more info on what conversation helper object can do. 

## Defining Events

Events are mentions to your bot user in a given slack workspace. 
They are defined in an easy manner with different semantics than slash commands.

Events expect to parse a regular expression to be matched by your bot. The scope where these regulars expressions are 
matcher, are supplied as construction parameters. This makes sense, since you might want to act differently to the same
string pattern in different application scopes.

An event is defined as:

```
    rusty.onEvent(
        ['test(.*)'],
        ['direct_mention','mention','app_mention'],
        (ch:ConversationHelper, event:string, heard:HearInfo ) => {
            ...
        });
```

First parameter is an array of patterns that you want be recognized to fire this event.
For example, in this case, a mention of the form `@youbot test abcd 1234` will fire this event's callback.
The callback will receive a [ConversationHelper](##ConversationHelper) as slash commands, but also the matched `event` 
string, as well as the regular expression matching info.

For this example, the way to send a response with what was typed after text could be:
`conversation_handler.reply(heard.matches[1]);`.

## ConsersationHelper

### Publishing content on channels

### Responding to events or slash commands

### Interactive conversations

## InteractiveConversationHelper