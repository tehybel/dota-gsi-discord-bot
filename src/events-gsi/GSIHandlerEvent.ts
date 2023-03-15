import {
    IEventHandlerEvents,
    IEventHandlerGameState,
} from "../events-app/IEventHandlers";
import GSI = require("node-gsi");
import appHandler from "../events-app/eventHandlers";
import SideEffect from "../SideEffect";

const interestedHandlers : IEventHandlerEvents[] = [
    appHandler.roshan,
];

function sameGSIEvent(event1: GSI.IEvent, event2: GSI.IEvent) {
    return event1.gameTime === event2.gameTime
        && event1.eventType === event2.eventType;
}

// Not currently subscribing to any game state changes, perhaps due to circular dependency?
export default class GSIHandlerEvent implements IEventHandlerGameState {
    // Note: right now events may overwrite each other if they have the same eventType and gameTime
    // 4 players grabbing 4 bounty runes at the same time will only count as 1 event
    // `allEvents` contains an array of all events seen so far
    allEvents: GSI.IEvent[] = [];

    inGame(newInGame: boolean) {
        if (!newInGame) {
            this.allEvents = [];
        }
        return {
            data: null,
            type: SideEffect.Type.NONE,
        };
    }

    neverSeenBefore(newEvent : GSI.IEvent) : boolean {
        return !this.allEvents
            .reduce(
                (haveSeenBefore, existingEvent) => sameGSIEvent(existingEvent, newEvent) || haveSeenBefore,
                false
            );
    }

    handle(events: GSI.IEvent[]) {
        events.map((newEvent) => {
            if (this.neverSeenBefore(newEvent)) {
                this.allEvents.push(newEvent);

                interestedHandlers
                    // events.gameTime start 258 seconds earlier than our map.gameTime for unknown reasons
                    .map((handler) => handler.handleEvent(newEvent.eventType, newEvent.gameTime - 258))
                    .map(({
                        data,
                        type,
                    }) => SideEffect.create(type, data).execute());
            }
        });
    }
}
