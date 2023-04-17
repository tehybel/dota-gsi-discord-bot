jest.mock("@discordjs/voice");
jest.mock("../../../customEngine");
jest.mock("../../../log");

import engine from "../../../customEngine";
import Fact from "../../../engine/Fact";
import { getResults } from "../../../__tests__/helpers";
import rule from "../startVoiceSubscription";
import topics from "../../../topics";
import Voice from "@discordjs/voice";

describe("startVoiceSubscription", () => {
    describe("has guildId and channelId", () => {
        let result: Fact<unknown>;

        let voiceConnection: Voice.VoiceConnection;
        let audioPlayer: Voice.AudioPlayer;
        beforeEach(() => {
            result = getResults(rule, {
                discordGuildChannelId: "channelId",
                discordGuildId: "guildId",
                studentId: "studentId",
            }) as Fact<unknown>;

            voiceConnection = (Voice.joinVoiceChannel as jest.Mock).mock
                .results[0].value;
            audioPlayer = (Voice.createAudioPlayer as jest.Mock).mock.results[0]
                .value;
        });

        describe("createVoiceConnection", () => {
            test("voice connection established", () => {
                expect(Voice.joinVoiceChannel).toHaveBeenCalledWith({
                    adapterCreator: "voiceAdapterCreator",
                    channelId: "channelId",
                    guildId: "guildId",
                });
                expect(voiceConnection).not.toBeUndefined();
            });

            describe("VoiceConnection.on", () => {
                let stateChangeFn: any;

                beforeEach(() => {
                    stateChangeFn = (voiceConnection.on as jest.Mock).mock
                        .lastCall[1];
                });

                test("registers for stateChange events", () => {
                    expect(voiceConnection.on).toHaveBeenCalledWith(
                        "stateChange",
                        stateChangeFn
                    );
                });

                test("on ready, notify engine", () => {
                    stateChangeFn(
                        { status: Voice.VoiceConnectionStatus.Destroyed },
                        { status: Voice.VoiceConnectionStatus.Ready }
                    );
                    expect(engine.setFact).toHaveBeenCalledWith(
                        "studentId",
                        new Fact(topics.discordReadyToPlayAudio, true)
                    );
                });

                test("on disconnected, mark guild and channel id as null and destroy connection", async () => {
                    (Voice.entersState as jest.Mock).mockRejectedValue("error");
                    await stateChangeFn(
                        { status: Voice.VoiceConnectionStatus.Ready },
                        { status: Voice.VoiceConnectionStatus.Disconnected }
                    );
                    expect(engine.setFact).toHaveBeenCalledWith(
                        "studentId",
                        new Fact(topics.discordGuildId, null)
                    );
                    expect(engine.setFact).toHaveBeenCalledWith(
                        "studentId",
                        new Fact(topics.discordGuildChannelId, null)
                    );
                });
            });
        });

        describe("createAudioPlayer", () => {
            test("create player", () => {
                expect(Voice.createAudioPlayer).toHaveBeenCalledTimes(1);
                expect(audioPlayer).not.toBeUndefined();
            });

            describe("AudioPlayer.on(stateChange)", () => {
                let stateChangeFn: any;

                beforeEach(() => {
                    stateChangeFn = (audioPlayer.on as jest.Mock).mock
                        .lastCall[1];
                });
                test("registers for stateChange events", () => {
                    expect(audioPlayer.on).toHaveBeenCalledWith(
                        "stateChange",
                        stateChangeFn
                    );
                });
                test("notify engine ready to play audio when state changes to Idle", () => {
                    stateChangeFn(
                        { status: Voice.AudioPlayerStatus.Playing },
                        { status: Voice.AudioPlayerStatus.Idle }
                    );
                    expect(engine.setFact).toHaveBeenCalledWith(
                        "studentId",
                        new Fact(topics.discordReadyToPlayAudio, true)
                    );
                });
                test("notify engine not ready to play audio when state changes to Buffering", () => {
                    stateChangeFn(
                        { status: Voice.AudioPlayerStatus.Idle },
                        { status: Voice.AudioPlayerStatus.Buffering }
                    );
                    expect(engine.setFact).toHaveBeenCalledWith(
                        "studentId",
                        new Fact(topics.discordReadyToPlayAudio, false)
                    );
                });
            });
        });

        describe("Voice.PlayerSubscription", () => {
            test("creates subscription", () => {
                expect(voiceConnection.subscribe).toHaveBeenCalledWith(
                    audioPlayer
                );
            });

            test("returns discord subscription fact", () => {
                expect(result).toContainFact(
                    "discordSubscriptionTopic",
                    (voiceConnection.subscribe as jest.Mock).mock.results[0]
                        .value
                );
            });
        });
    });

    describe("missing guildId or channelId", () => {
        let destroyFn = jest.fn();
        beforeEach(() => {
            (engine.getFactValue as jest.Mock).mockReturnValue({
                connection: { destroy: destroyFn },
            });
        });
        test("no guild Id", () => {
            getResults(rule, {
                discordGuildChannelId: "channelId",
                discordGuildId: null,
                studentId: "studentId",
            }) as Fact<unknown>;

            expect(engine.setFact).toHaveBeenCalledWith(
                "studentId",
                new Fact(topics.discordSubscriptionTopic, undefined)
            );
            expect(destroyFn).toHaveBeenCalled();
        });

        test("no channel Id", () => {
            getResults(rule, {
                discordGuildChannelId: null,
                discordGuildId: "guildId",
                studentId: "studentId",
            }) as Fact<unknown>;

            expect(engine.setFact).toHaveBeenCalledWith(
                "studentId",
                new Fact(topics.discordSubscriptionTopic, undefined)
            );
            expect(destroyFn).toHaveBeenCalled();
        });
    });
});
