import EffectConfig from "./effects/EffectConfig";
import effectConfig from "./effectConfigManager";
import engine from "./customEngine";
import express from "express";
import Fact from "./engine/Fact";
import { factsToPlainObject } from "./engine/PersistentFactStore";
import gsi from "node-gsi";
import GsiData from "./gsi/GsiData";
import gsiParser from "./gsiParser";
import helper from "./assistants/helpers/timeFormatting";
import log from "./log";
import path from "path";
import persistence from "./persistence";
import { Status } from "./assistants/helpers/roshan";
import topicManager from "./engine/topicManager";
import topics from "./topics";

const defaultConfigInfo = Object.fromEntries(
    effectConfig.defaultConfigInfo.map((configInfo) => [
        configInfo.ruleIndentifier,
        configInfo,
    ])
);

const app = express();

app.set("strict routing", true);
app.set("x-powered-by", false);

const router = express.Router({ strict: true });

router.use(express.json());

router.use(
    "/resources/audio",
    express.static(path.join(__dirname, "../resources/audio"))
);

router.post("/debug_save-state", (req, res) => {
    const stateObj = Array.from(engine.getSessions().entries()).reduce(
        (memo: { [key: string]: unknown }, [studentId, db]) => {
            memo[studentId] = factsToPlainObject(
                db
                    .debug_getAllFacts()
                    .filter(
                        (fact) =>
                            fact.topic.label !== "discordSubscriptionTopic"
                    )
            );
            return memo;
        },
        {}
    );
    console.log(stateObj);
    persistence.debug_saveAllState(JSON.stringify(stateObj));
    res.status(200).send();
});

router.post("/coach/:studentId/debug_playPublicAudio", (req, res) => {
    engine.setFact(
        req.params.studentId,
        new Fact(topics.playPublicAudio, "resources/audio/jeopardy.mp3")
    );
    res.status(200).send();
});

router.post("/coach/:studentId/debug_playPrivateAudio", (req, res) => {
    engine.setFact(
        req.params.studentId,
        new Fact(topics.playPrivateAudio, "resources/audio/jeopardy.mp3")
    );
    res.status(200).send();
});

router.get("/instructions", (req, res) => {
    res.status(200).sendFile(
        path.join(__dirname, "../resources/instructions.html")
    );
});

router.get("/coach/:studentId/", (req, res) => {
    res.status(200).sendFile(
        path.join(__dirname, "../resources/studentPage.html")
    );
});

router.post("/coach/:studentId/start", (req, res) => {
    const studentId = req.params.studentId;
    const existingSession = engine.getSession(studentId);
    if (existingSession) {
        engine.setFact(
            studentId,
            new Fact(topics.privateAudioQueue, undefined)
        );
    } else {
        engine.startCoachingSession(studentId);
    }
    res.status(200).send();
});

router.post("/coach/:studentId/stop", (req, res) => {
    engine.deleteSession(req.params.studentId);
    res.status(200).send();
});

router.get("/coach/:studentId/discord-audio-enabled", (req, res) => {
    res.status(200).json(
        engine.getFactValue(req.params.studentId, topics.discordAudioEnabled) ||
            false
    );
});

router.get("/coach/:studentId/config/get", (req, res) => {
    res.status(200).json(
        topicManager
            .getConfigTopics()
            .map((topic) => [
                defaultConfigInfo[topic.label].ruleIndentifier,
                defaultConfigInfo[topic.label].ruleName,
                engine.getFactValue(req.params.studentId, topic),
                defaultConfigInfo[topic.label].description,
            ])
    );
});

router.post("/coach/:studentId/config/:topic/:effect", (req, res) => {
    engine.setFact(
        req.params.studentId,
        new Fact<EffectConfig>(
            topicManager.findTopic(req.params.topic),
            effectConfig.effectFromString(req.params.effect)
        )
    );
    res.status(200).send();
});

router.post("/coach/:studentId/config/reset", (req, res) => {
    effectConfig
        .defaultConfigFacts()
        .map((fact) => engine.setFact(req.params.studentId, fact));
    res.status(200).send();
});

router.post("/coach/:studentId/config/PRIVATE", (req, res) => {
    topicManager.getConfigTopics().forEach((topic) => {
        const config = engine.getFactValue(req.params.studentId, topic);
        if (
            config === EffectConfig.PUBLIC ||
            config === EffectConfig.PUBLIC_INTERRUPTING
        ) {
            engine.setFact(
                req.params.studentId,
                new Fact(topic, EffectConfig.PRIVATE)
            );
        }
    });
    res.status(200).send();
});

function getNextAudio(studentId: string) {
    const queue = engine.getFactValue(studentId, topics.privateAudioQueue);
    if (queue && queue.length > 0) {
        const newQueue = [...queue];
        const nextFile = newQueue.splice(0, 1)[0];
        engine.setFact(studentId, new Fact(topics.privateAudioQueue, newQueue));
        return nextFile;
    }
}

router.get("/coach/:studentId/poll/audio", (req, res) => {
    const studentId = req.params.studentId;
    const nextAudio = getNextAudio(studentId);
    if (nextAudio) {
        log.info(
            "effect",
            "%s - Playing private audio %s for %s",
            helper.secondsToTimeString(
                engine.getFactValue(studentId, topics.time) || 0
            ),
            nextAudio.magenta,
            studentId.substring(0, 10)
        );
    }
    res.status(200).json({ nextAudio: nextAudio });
});

// TODO rename to updatedConfig
function updateFrontend(studentId: string) {
    const updated = engine.getFactValue(studentId, topics.updateFrontend);
    if (updated) {
        engine.setFact(studentId, new Fact(topics.updateFrontend, undefined));
    }
    return updated;
}

router.get("/coach/:studentId/poll/config", (req, res) => {
    const studentId = req.params.studentId;
    res.status(200).json({ updateFrontend: updateFrontend(studentId) });
});

function roshNumbers(studentId: string) {
    return [
        topics.roshanAegisExpiryTime,
        topics.roshanMaybeAliveTime,
        topics.roshanAliveTime,
    ]
        .map((topic) => engine.getFactValue(studentId, topic))
        .map((time) => helper.secondsToTimeString(time!))
        .join(" - ");
}

function roshanMessage(studentId: string) {
    const status = engine.getFactValue(studentId, topics.roshanStatus);
    switch (status) {
        case Status.NOT_IN_A_GAME:
            return "Not in a game";
        case Status.ALIVE:
            return "Alive";
        case Status.MAYBE_ALIVE:
            return `Maybe alive     ${roshNumbers(studentId)}`;
        case Status.DEAD:
            return `Dead     ${roshNumbers(studentId)}`;
        default:
            return "Unknown";
    }
}

router.get("/coach/:studentId/poll/roshan", (req, res) => {
    const studentId = req.params.studentId;
    res.status(200).json({
        roshanStatus: roshanMessage(studentId),
    });
});

router.post("/coach/:studentId/stop-audio", (req, res) => {
    engine.setFact(req.params.studentId, new Fact(topics.stopAudio, true));
    engine.setFact(
        req.params.studentId,
        new Fact(topics.privateAudioQueue, undefined)
    );
    engine.setFact(
        req.params.studentId,
        new Fact(topics.publicAudioQueue, undefined)
    );
    res.status(200).send();
});

router.post("/coach/:studentId/skywrath", (req, res) => {
    engine.setFact(
        req.params.studentId,
        new Fact(
            topics.playInterruptingAudioFile,
            "resources/audio/skywrath.mpeg"
        )
    );
    res.status(200).send();
});

router.head("/gsi", (req, res) => {
    res.status(200).send();
});

router.post("/gsi", (req, res) => {
    gsiParser.feedState(req.body);
    res.status(200).send();
});

// GSI CODE

gsiParser.events.on(gsi.Dota2Event.Dota2State, (data: gsi.IDota2StateEvent) => {
    // Check to see if we care about this auth token before sending info to the engine
    // See if it matches topic.discordCoachMe and is not undefined
    engine.setFact(
        data.auth,
        new Fact(
            topics.allData,
            new GsiData({
                events: data.state.events,
                hero: data.state.hero,
                items: data.state.items,
                map: data.state.map,
                player: data.state.player,
                provider: data.state.provider,
            })
        )
    );
});

// If we are looking at a replay or as an observer,
// run all logic on the items of one of the players only (from 0-9)
// needs to be 6 for mitmproxy die-respawn-dig_canna to run properly
const playerId = 6;
gsiParser.events.on(
    gsi.Dota2Event.Dota2ObserverState,
    (data: gsi.IDota2ObserverStateEvent) => {
        engine.setFact(
            data.auth,
            new Fact(
                topics.allData,
                new GsiData({
                    events: data.state.events,
                    hero: data.state.hero?.at(playerId) || null,
                    items: data.state.items?.at(playerId) || null,
                    map: data.state.map,
                    player: data.state.player?.at(playerId) || null,
                    provider: data.state.provider,
                })
            )
        );
    }
);

app.use("/", router);

export default app;
