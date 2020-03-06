import { RewriteFrames } from "@sentry/integrations";
import * as Sentry from "@sentry/node";
import { Separated } from "fp-ts/lib/Compactable";
import { observable } from "fp-ts-rxjs/lib/Observable";
import { Observable, fromEventPattern } from "rxjs";

import { Event, EventStateChanged, HomeAssistant } from "./ha";

const ha_url = process.env.HA_URL!;
const ha_access_token = process.env.HA_ACCESS_TOKEN!;
const sentry_dsn = process.env.SENTRY_DSN;

var captureException: (e: Error) => void = console.debug;
if (sentry_dsn) {
  const rootDir = __dirname || process.cwd();

  Sentry.init({
    dsn: sentry_dsn,
    integrations: [new RewriteFrames({ root: rootDir })],
  });

  captureException = Sentry.captureException
}

const ha = new HomeAssistant(ha_url, ha_access_token);

const separated: Separated<Observable<Error>, Observable<Event>> = observable.separate(
  fromEventPattern(ha.subscribe.bind(ha))
);

const errors = separated.left;
errors.subscribe(captureException);

const events = separated.right;

function isStateChanged(e: Event): e is EventStateChanged {
  return e.event_type == "state_changed";
}
const stateChanges = observable.filter(events, isStateChanged);

const guestMode = observable.filter(stateChanges, e => e.data.entity_id == "input_boolean.guest_mode");

guestMode.subscribe(console.debug);



// const guestMode = stateChanged.pipe(filter(event => event.data.entity_id == "input_boolean.guest_mode"));

// guestMode.subscribe(event => {
//   // {"scene_id":"good_night","entities":{"group.all_covers":"closed","group.all_locks":"locked","light.entrance":"off","light.garage":"off","light.top_landing":"off","light.upper_stairs":"off"}}
//   // {"scene_id":"good_night","entities":{"group.all_covers":"closed","group.all_lights":"off","group.all_locks":"locked"}}
//   // const entities = {
//   //   "group.all_covers": "closed",
//   //   "group.all_locks": "locked",
//   // };
//   console.debug(event);
// });

// // observable.subscribe({
// //   next(x) { console.debug(x) },
// //   error(err) { throw err },
// //   complete() {}
// // });
