import Event, { EventType } from "../gsi-data-classes/Event";
import { DeepReadonly } from "ts-essentials";
import { EffectConfig } from "../effectConfigManager";
import Fact from "../engine/Fact";
import helper from "./assistantHelpers";
import Rule from "../engine/Rule";
import RuleDecoratorConfigurable from "../engine/RuleDecoratorConfigurable";
import RuleDecoratorInGame from "../engine/RuleDecoratorInGame";
import rules from "../rules";
import topicManager from "../engine/topicManager";
import topics from "../topics";

export const configTopic = topicManager.createConfigTopic("Roshan");
export const defaultConfig = EffectConfig.PUBLIC;
export const assistantDescription =
    'Tracks roshan respawn time. Responds to discord voice command "What is rosh/roshan status/timer"';

const AEGIS_DURATION = 5 * 60;
const ROSHAN_MINIMUM_SPAWN_TIME = 8 * 60;
const ROSHAN_MAXIMUM_SPAWN_TIME = 11 * 60;

const roshanDeathTimesTopic = topicManager.createTopic<number[]>(
    "roshanDeathTimesTopic",
    {
        persistAcrossRestarts: true,
    }
);

// TODO add test for alive message
function aliveMessage(deathTimes: number[], dayTime: boolean) {
    const times = deathTimes.length;
    if (times === 0) {
        return "Roshan is alive. Will drop aegis";
    }
    if (times === 1) {
        return "Roshan is alive. Will drop aegis and cheese";
    }
    if (dayTime) {
        return "Roshan is alive. Will drop aegis, cheese, and aghanim's blessing";
    } else {
        return "Roshan is alive. Will drop aegis, cheese, and refresher shard";
    }
}

function roshanWasKilled(events: DeepReadonly<Event[]>) {
    return events.reduce(
        (memo, event) => event.type === EventType.RoshanKilled || memo,
        false
    );
}

function roshStatusMessage(message: string) {
    return message.match(/^(what).{1,15}(status|timer?)$/i) !== null;
}

const roshRulesArray = [
    // When an event notifies us that roshan is killed
    // Add time to list of times roshan has fallen
    new Rule(
        rules.assistant.roshan.killedEvent,
        [topics.time, topics.events],
        (get) => {},
        ([_, events]) => roshanWasKilled(events),
        ([time, _], get) =>
            new Fact(roshanDeathTimesTopic, [
                ...get(roshanDeathTimesTopic)!,
                time,
            ]),
        [[roshanDeathTimesTopic, []]]
    ),

    // When time is when roshan might be alive
    // Play audio
    new RuleDecoratorConfigurable(
        configTopic,
        new Rule(
            rules.assistant.roshan.maybeAliveTime,
            [topics.time, roshanDeathTimesTopic],
            (get) => {
                if (
                    get(topics.time)! ===
                    get(roshanDeathTimesTopic)!.at(-1)! +
                        ROSHAN_MINIMUM_SPAWN_TIME
                ) {
                    return new Fact(
                        topics.configurableEffect,
                        "resources/audio/rosh-maybe.mp3"
                    );
                }
            }
        )
    ),

    // When time is when roshan should be alive
    // Play audio
    new RuleDecoratorConfigurable(
        configTopic,
        new Rule(
            rules.assistant.roshan.aliveTime,
            [topics.time, roshanDeathTimesTopic],
            (get) => {
                if (
                    get(topics.time)! ===
                    get(roshanDeathTimesTopic)!.at(-1)! +
                        ROSHAN_MAXIMUM_SPAWN_TIME
                ) {
                    return new Fact(
                        topics.configurableEffect,
                        "resources/audio/rosh-alive.mp3"
                    );
                }
            }
        )
    ),
    new RuleDecoratorConfigurable(
        configTopic,
        new Rule(
            rules.assistant.roshan.voice,
            [topics.lastDiscordUtterance],
            (get) => {
                if (!roshStatusMessage(get(topics.lastDiscordUtterance)!)) {
                    return;
                }
                const deathTimes = get(roshanDeathTimesTopic) || [];
                const deathTime = deathTimes?.at(-1);
                const time = get(topics.time)!;
                let response = aliveMessage(deathTimes, get(topics.dayTime)!);

                if (deathTime) {
                    if (time < deathTime + AEGIS_DURATION) {
                        response = `Roshan is dead. Aegis expires at ${
                            (helper.secondsToTimeString(
                                deathTime + AEGIS_DURATION
                            ),
                            true)
                        }`;
                    } else if (time < deathTime + ROSHAN_MINIMUM_SPAWN_TIME) {
                        response = `Roshan is dead. May respawn at ${
                            (helper.secondsToTimeString(
                                deathTime + ROSHAN_MINIMUM_SPAWN_TIME
                            ),
                            true)
                        }`;
                    } else if (time < deathTime + ROSHAN_MAXIMUM_SPAWN_TIME) {
                        response = `Roshan may be alive. Guaranteed respawn at ${
                            (helper.secondsToTimeString(
                                deathTime + ROSHAN_MAXIMUM_SPAWN_TIME
                            ),
                            true)
                        }`;
                    }
                }
                return new Fact(topics.configurableEffect, response);
            }
        )
    ),
].map((rule) => new RuleDecoratorInGame(rule));

export default roshRulesArray;
