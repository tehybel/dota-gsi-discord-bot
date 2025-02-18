import CryptoJS from "crypto-js";
import Engine from "../engine/Engine";
import engine from "../customEngine";
import log from "../log";
import topics from "../topics";

function numberOfPeopleConnected(guildId: string, channelId: string): number {
    return Array.from(engine.getSessions().values()).filter(
        (db) =>
            Engine.get(db, topics.discordGuildId) === guildId &&
            Engine.get(db, topics.discordGuildChannelId) === channelId
    ).length;
}

function hashStudentId(userId: string): string {
    const key = process.env.STUDENT_ID_HASH_PRIVATE_KEY;
    if (key) {
        // eslint-disable-next-line new-cap
        return CryptoJS.HmacSHA256(userId, key).toString();
    } else {
        log.error(
            "discord",
            "Unable to find %s environment variable, so continuing without hashing. Check your .env file",
            "STUDENT_ID_HASH_PRIVATE_KEY"
        );
        return userId;
    }
}

export default {
    hashStudentId,
    numberOfPeopleConnected,
};
