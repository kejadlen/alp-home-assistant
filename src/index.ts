import { RewriteFrames } from "@sentry/integrations";
import * as Sentry from "@sentry/node";
import { Separated } from "fp-ts/lib/Compactable";
import { observable } from "fp-ts-rxjs/lib/Observable";
import { Observable, fromEventPattern } from "rxjs";

import { Event, EventStateChanged, HomeAssistant } from "./ha";

function fetchEnv(key: string): string {
  const value = process.env[key];
  if (value === undefined) {
    throw new Error("Expected environment variable `${key}` to exist");
  }
  return value;
}

const haUrl = fetchEnv("HA_URL");
const haAccessToken = fetchEnv("HA_ACCESS_TOKEN");
const sentryDsn = process.env.SENTRY_DSN;

let captureException: (e: Error) => void = console.debug;
if (sentryDsn) {
  const rootDir = __dirname || process.cwd();

  Sentry.init({
    dsn: sentryDsn,
    integrations: [new RewriteFrames({ root: rootDir })],
  });

  captureException = Sentry.captureException;
}

const ha = new HomeAssistant(haUrl, haAccessToken);

const separated: Separated<
  Observable<Error>,
  Observable<Event>
> = observable.separate(fromEventPattern(ha.subscribe.bind(ha)));

const errors = separated.left;
errors.subscribe(captureException);

const events = separated.right;

function isStateChanged(e: Event): e is EventStateChanged {
  return e.event_type == "state_changed";
}
const stateChanges = observable.filter(events, isStateChanged);

const guestMode = observable.filter(
  stateChanges,
  (e) => e.data.entity_id == "input_boolean.guest_mode",
);

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
