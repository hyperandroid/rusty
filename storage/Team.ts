export interface Bot {
    access_token: string;
    user_id: string;
    created_by: string;
    app_token: string;
    name?: string;      // bot name.
}

export interface TeamIncomingWebHook {
    token : string;
    createdBy : string;
    url : string;
    channel : string;
    configuration_url : string;
}

export interface Team {
    id : string;
    name : string;
    created_by : string;
    url : string;

    /**
     * Bot info.
     */
    bot? : Bot;

    /**
     * If defined, incoming webhook.
     */
    incoming_web_hook? : TeamIncomingWebHook;

    /**
     * Accepted scopes list.
     */
    scopes : string[];
}
