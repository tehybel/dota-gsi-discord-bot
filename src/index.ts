import dotenv = require("dotenv");
dotenv.config();

// Enabled GSI
import "./gsi/gsiEvents";
import "./gsi/gsiGameState";
import "./gsi/gsiHero";
import "./gsi/gsiItems";
import "./gsi/gsiTime";

// Enabled assistants
import "./assistants/roshan";
import "./assistants/runes";
import "./assistants/neutralItem";

// Enabled effects
import "./effects/playAudio";
import "./effects/playTts";

// Discord
import "./discord/registerDiscord";
import "./discord/playAudioQueue";
import "./discord/slashCommand";

import engine from "./customEngine";
import gsi = require("node-gsi");
import log from "./log";

const botSecretKey = process.env.DISCORD_CLIENT_TOKEN;
if (botSecretKey) {
    engine.setDiscordBotSecretKey(botSecretKey);
} else {
    log.error(
        "discord",
        "Unable to find bot secret key. Expected environment variable %s",
        "DISCORD_CLIENT_TOKEN"
    );
}

const discordGuildId = process.env.HARD_CODED_GUILD_ID;
const discordChannelId = process.env.HARD_CODED_VOICE_CHANNEL_ID;
if (discordGuildId && discordChannelId) {
    engine.setDiscordBotGuildIdAndChannelId(discordGuildId, discordChannelId);
} else {
    log.error(
        "discord",
        "Unable to find bot channel or guild id. Expected environment variables %s and %s",
        "HARD_CODED_GUILD_ID",
        "HARD_CODED_VOICE_CHANNEL_ID"
    );
}

const debug = process.env.GSI_DEBUG === "true";
const server = new gsi.Dota2GSIServer("/gsi", debug);

// TODO refactor time and gamestate to be under map and split up later
server.events.on(gsi.Dota2Event.Dota2State, (data: gsi.IDota2StateEvent) => {
    // Check to see if we care about this auth token before sending info to the engine
    // See if it matches topic.discordCoachMe and is not undefined
    if (data.auth) {
        engine.setGsi(data.auth, {
            events: data.state.events,
            gameState: data.state.map?.gameState,
            hero: data.state.hero,
            items: data.state.items,
            time: data.state.map?.clockTime,
        });
    }
});

// If we are looking at a replay or as an observer,
// run all logic on the items of one of the players only (from 0-9)
const playerId = 6;
server.events.on(
    gsi.Dota2Event.Dota2ObserverState,
    (data: gsi.IDota2ObserverStateEvent) => {
        if (data.auth) {
            engine.setGsi(data.auth, {
                events: data.state.events,
                gameState: data.state.map?.gameState,
                hero: data.state.hero?.at(playerId),
                items: data.state.items?.at(playerId),
                time: data.state.map?.clockTime,
            });
        }
    }
);

log.info("gsi", "Starting GSI server on port 9001");
// eslint-disable-next-line no-magic-numbers
server.listen(9001);
