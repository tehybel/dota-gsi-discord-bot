import sut from "../timeFormatting";

describe("time helpers", () => {
    describe("seconds to time string", () => {
        test("it formats properly", () => {
            expect(sut.secondsToTimeString(0)).toBe("00:00");
            expect(sut.secondsToTimeString(60 * 60)).toBe("1:00:00");
        });
    });
    describe("seconds to TTS time string", () => {
        test("removes colon", () => {
            expect(sut.secondsToTtsTimeString(10 * 60 + 5)).toBe("10 05");
        });
        test("removes leading 0", () => {
            expect(sut.secondsToTtsTimeString(1)).toBe("0 01");
        });
        test("turns :00 seconds into minutes string", () => {
            expect(sut.secondsToTtsTimeString(10 * 60)).toBe("10 minutes");
        });

        test("ignores hour", () => {
            expect(sut.secondsToTtsTimeString(70 * 60)).toBe("10 minutes");
        });
    });
});
