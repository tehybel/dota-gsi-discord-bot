import Config from "./configTopics";
import Engine from "./engine/Engine";
import Fact from "./engine/Fact";
import FactStore from "./engine/FactStore";
import fs from "fs";
import GsiData from "./gsi/GsiData";
import log from "./log";
import path from "path";
import Topic from "./engine/Topic";
import topics from "./topics";

class CustomEngine extends Engine {
    private sessions: Map<string, FactStore> = new Map();

    private withDb(
        studentId: string | null,
        effectFn: (db: FactStore) => unknown
    ) {
        if (studentId) {
            const db = this.sessions.get(studentId);
            if (db) {
                return effectFn(db);
            }
        }
    }

    private alreadyConnectedToVoiceChannel(guildId: string, channelId: string) {
        return Object.entries(this.sessions).reduce((memo, [_, db]) => {
            const existingGuildId = db.get(topics.discord.discordGuildId);
            const existingChannelId = db.get(
                topics.discord.discordGuildChannelId
            );
            return (
                memo ||
                (existingGuildId === guildId && existingChannelId === channelId)
            );
        }, false);
    }

    private setDefaultAssistantConfig(studentId: string) {
        const dirPath = path.join(__dirname, "assistants");
        fs.readdirSync(dirPath)
            .filter((file) => file.endsWith(".js") || file.endsWith(".ts"))
            .map((file) => path.join(dirPath, file))
            .map((filePath) => require(filePath))
            .forEach((module) => {
                const topic = module.configTopic as Topic<Config>;
                const config = module.defaultConfig as Config;
                if (topic && config) {
                    engine.setConfig(studentId, topic, config);
                } else {
                    log.error(
                        "rules",
                        "No default configuration for %s",
                        topic.label
                    );
                }
            });
    }

    private setConfig(studentId: string, topic: Topic<Config>, config: Config) {
        this.withDb(studentId, (db) => this.set(db, new Fact(topic, config)));
    }

    public setGsi(studentId: string | null, data: GsiData) {
        this.withDb(studentId, (db) =>
            this.set(db, new Fact(topics.gsi.allData, data))
        );
    }

    public readyToPlayAudio(studentId: string, ready: boolean) {
        this.withDb(studentId, (db) =>
            this.set(
                db,
                new Fact(topics.discord.discordReadyToPlayAudio, ready)
            )
        );
    }

    public startCoachingSession(
        studentId: string,
        guildId: string,
        channelId: string
    ) {
        this.sessions.set(studentId, new FactStore());
        this.setDefaultAssistantConfig(studentId);
        this.withDb(studentId, (db) => {
            this.set(db, new Fact(topics.studentId, studentId));
            // Do not connect again if bot is already connected to a voice channel
            // (through someone else's /coachme)
            if (!this.alreadyConnectedToVoiceChannel(guildId, channelId)) {
                this.set(db, new Fact(topics.discord.discordGuildId, guildId));
                this.set(
                    db,
                    new Fact(topics.discord.discordGuildChannelId, channelId)
                );
            }
        });
    }

    public stopCoachingSession(studentId: string) {
        this.withDb(studentId, (db) => {
            const subscription = db.get(
                topics.discord.discordSubscriptionTopic
            );
            subscription?.connection.destroy();
        });
    }

    public lostVoiceConnection(studentId: string) {
        log.info("rules", "Deleting database for student %s", studentId);
        this.sessions.delete(studentId);
    }

    public handleNextPrivateAudio(studentId: string) {
        return this.withDb(studentId, (db) => {
            const queue = db.get(topics.effect.privateAudioQueue);
            if (queue && queue.length > 0) {
                const newQueue = [...queue];
                const nextFile = newQueue.pop()!;
                db.set(new Fact(topics.effect.privateAudioQueue, newQueue));
                return nextFile;
            }
        }) as string | void;
    }
}

const engine = new CustomEngine();

export default engine;
