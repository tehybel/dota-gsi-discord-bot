import {
    IDota2ObserverState, IDota2State,
} from "node-gsi";
import GsiSubject from "./GsiSubject";
import log from "../log";

export default class GsiItemsSubject extends GsiSubject {
    public handleState(state: IDota2State | IDota2ObserverState): void {
        if (Array.isArray(state.items)) { // If we are in observer mode
            log.gsi.debug(state.items[0]); // Pick the first person
        }
        // State
        // {"slot":[],"stash":[]}
        //
        // Observer state
        // [
        //     {"slot":[],"stash":[]},
        //     {"slot":[],"stash":[]},
        //     {"slot":[],"stash":[]},
        //     {"slot":[],"stash":[]},
        //     {"slot":[],"stash":[]},
        //     {"slot":[],"stash":[]},
        //     {"slot":[],"stash":[]},
        //     {"slot":[],"stash":[]},
        //     {"slot":[],"stash":[]},
        //     {"slot":[],"stash":[]}
        // ]
    }
}
