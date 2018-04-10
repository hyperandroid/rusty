# Rusty

A minimalistic slack bot (currently only a WebBot).

Rusty relies on Express to set bot end points.

## Simple example

The simplest example could be echoing information received by a predefined slash command.

`app` is an express instance and `credentials` valid Slack Application credentials (see configuration for more info).

```
const bh = new BotHandler()
    .installForWebServer(app, credentials)
    .onSlashCommand(
        '/slang',
        (ch:ConversationHelper, command:string, text:string) => {
            if (command==='/slang' ) {
                ch.reply(text);
            }
        });
```

## Configuration

