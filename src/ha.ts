import { pipe } from "fp-ts/lib/pipeable"
import { Either, chain, isLeft, left, mapLeft, parseJSON, right, toError } from "fp-ts/lib/Either"
import * as t from "io-ts";
import { failure } from "io-ts/lib/PathReporter"
import WebSocket from "ws";

const EntityState = t.type({
  state: t.string,
});

const EventCallService = t.type({
  event_type: t.literal("call_service"),
});
const EventStateChanged = t.type({
  event_type: t.literal("state_changed"),
  data: t.type({
    entity_id: t.string,
    old_state: EntityState,
    new_state: EntityState,
  }),
});
type EventStateChanged = t.TypeOf<typeof EventStateChanged>;

const Event = t.union([
  EventCallService,
  EventStateChanged,
]);
type Event = t.TypeOf<typeof Event>;

type EventCallback = (result: Either<Error, Event>) => void;

class HomeAssistant {
  url: string;
  access_token: string;
  id = 0;

  constructor(url: string, access_token: string) {
    this.url = url;
    this.access_token = access_token;
  }

  subscribe(callback: EventCallback): void {
    const ws = new WebSocket(this.url);
    ws.on("message", data => {
      this.id += 1;

      const decodeMessage = (json: unknown) => pipe(
        Message.decode(json),
        mapLeft(errors => {
          const subErrors = failure(errors).map(e => `  - ${e}`);
          const message = [`Unable to parse '${data}'`].concat(subErrors).join("\n");
          return new Error(message);
        }),
      );

      const decoded = pipe(
        parseJSON(data.toString(), toError),
        chain(decodeMessage),
      );

      if (isLeft(decoded)) {
        callback(left(decoded.left));
        return;
      }

      const message = decoded.right;
      switch(message.type) {
        case "auth_required":
          ws.send(JSON.stringify({ type: "auth", access_token: this.access_token }));
          return;
        case "auth_ok":
          ws.send(JSON.stringify({ id: this.id, type: "subscribe_events" }));
          return;
        case "event":
          callback(right(message.event));
          return;
        case "result":
          return;
        default:
          throw new Error("unreachable!");
      }
    });
  }
}

const Message = t.union([
  t.type({
    type: t.keyof({
      "auth_required": null,
      "auth_ok": null,
      "result": null,
    }),
  }),
  t.type({
    type: t.literal("event"),
    event: Event,
  }),
]);
type Message = t.TypeOf<typeof Message>;

export { Event, EventStateChanged, HomeAssistant };
