import {
    IGsiEventsObserver,
    IGsiGameStateObserver,
    IGsiTimeObserver,
} from "../../IGsiObservers";
import SideEffectInfo, {
    Type,
} from "../../SideEffectInfo";
import Constants from "./Constants";
import logic from "./logic";

export default class RoshanPlugin
implements IGsiTimeObserver, IGsiGameStateObserver, IGsiEventsObserver {
    private currentTime: number | undefined;
    private lastRoshanDeathTime: number | undefined;
    private roshStatus: string | undefined;

    private resetState() {
        this.currentTime = undefined;
        this.lastRoshanDeathTime = undefined;
        this.roshStatus = Constants.Status.ALIVE;
    }

    public constructor() {
        this.resetState();
    }

    public inGame(inGame: boolean) : SideEffectInfo {
        if (!inGame) {
            this.resetState();
        }
        return SideEffectInfo.none();
    }

    public handleTime(time: number) : SideEffectInfo {
        this.currentTime = time;
        const newRoshStatus = logic(time, this.lastRoshanDeathTime);
        if (newRoshStatus !== this.roshStatus) {
            this.roshStatus = newRoshStatus;
            switch (newRoshStatus) {
                case Constants.Status.ALIVE:
                    return new SideEffectInfo(Type.AUDIO_FILE, "rosh-alive.mp3");
                case Constants.Status.UNKNOWN:
                    return new SideEffectInfo(Type.AUDIO_FILE, "rosh-maybe.mp3");
                default:
                    break;
            }
        }
        return SideEffectInfo.none();
    }

    public handleEvent(eventType: string, _time: number) : SideEffectInfo {
        // `time` we get from the event is incorrect - use current time instead
        if (eventType === "roshan_killed") {
            this.lastRoshanDeathTime = this.currentTime;
            this.roshStatus = Constants.Status.DEAD;
        }
        return SideEffectInfo.none();
    }
}
