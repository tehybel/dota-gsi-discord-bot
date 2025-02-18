import atMinute from "../engine/rules/atMinute";
import ConfigInfo from "../ConfigInfo";
import configurable from "../engine/rules/configurable";
import EffectConfig from "../effects/EffectConfig";
import Fact from "../engine/Fact";
import Rule from "../engine/Rule";
import rules from "../rules";
import topics from "../topics";

export const configInfo = new ConfigInfo(
    rules.assistant.shard,
    "Shard",
    "Reminds you of shard availability at 15:00",
    EffectConfig.NONE
);

const SHARD_SPAWN_MINUTE = 15;

export default atMinute(
    SHARD_SPAWN_MINUTE,
    configurable(
        configInfo.ruleIndentifier,
        new Rule({
            label: rules.assistant.shard,
            then: () =>
                new Fact(
                    topics.configurableEffect,
                    "resources/audio/shard-available.mp3"
                ),
        })
    )
);
