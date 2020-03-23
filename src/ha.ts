import { pipe } from "fp-ts/lib/pipeable"
import { Either, chain, isLeft, left, mapLeft, parseJSON, right, toError } from "fp-ts/lib/Either"
import * as t from "io-ts";
import { failure } from "io-ts/lib/PathReporter"
import WebSocket from "ws";

const EntityState = t.type({
  state: t.string,
});

const EventCallService = t.type({
  event_type: t.literal("call_service"), // eslint-disable-line @typescript-eslint/camelcase
});
const EventStateChanged = t.type({
  event_type: t.literal("state_changed"), // eslint-disable-line @typescript-eslint/camelcase
  data: t.type({
    entity_id: t.string,    // eslint-disable-line @typescript-eslint/camelcase
    old_state: EntityState, // eslint-disable-line @typescript-eslint/camelcase
    new_state: EntityState, // eslint-disable-line @typescript-eslint/camelcase
  }),
});
type EventStateChanged = t.TypeOf<typeof EventStateChanged>;

const Event = t.union([
  EventCallService,
  EventStateChanged,
]);
type Event = t.TypeOf<typeof Event>;

type EventCallback = (result: Either<Error, Event>) => void;

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

class HomeAssistant {
  url: string;
  accessToken: string;
  id = 0;

  constructor(url: string, accessToken: string) {
    this.url = url;
    this.accessToken = accessToken;
  }

  subscribe(callback: EventCallback): void {
    const ws = new WebSocket(this.url);
    ws.on("message", data => {
      this.id += 1;

      const decodeMessage: (json: unknown) => Either<Error, Message> = json => pipe(
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
          // eslint-disable-next-line @typescript-eslint/camelcase
          ws.send(JSON.stringify({ type: "auth", access_token: this.accessToken }));
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

export { Event, EventStateChanged, HomeAssistant };
