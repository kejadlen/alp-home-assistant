import { pipe } from "fp-ts/lib/pipeable";
import {
  Either,
  chain,
  isLeft,
  left,
  mapLeft,
  parseJSON,
  right,
  toError,
} from "fp-ts/lib/Either";
import { failure } from "io-ts/lib/PathReporter";
import WebSocket from "ws";

import { Event, EventStateChanged, Message } from "./haTypes";

type EventCallback = (result: Either<Error, Event>) => void;

class HomeAssistant {
  private url: string;
  private accessToken: string;
  private id = 0;

  constructor(url: string, accessToken: string) {
    this.url = url;
    this.accessToken = accessToken;
  }

  subscribe(callback: EventCallback): void {
    const ws = new WebSocket(this.url);
    ws.on("message", (data) => {
      this.id += 1;

      const decoded = pipe(
        parseJSON(data.toString(), toError),
        chain(this.decodeMessage),
      );

      if (isLeft(decoded)) {
        callback(left(decoded.left));
        return;
      }

      const message = decoded.right;
      switch (message.type) {
        case "auth_required":
          ws.send(
            // eslint-disable-next-line @typescript-eslint/camelcase
            JSON.stringify({ type: "auth", access_token: this.accessToken }),
          );
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

  private decodeMessage(json: unknown): Either<Error, Message> {
    return pipe(
      Message.decode(json),
      mapLeft((errors) => {
        const subErrors = failure(errors).map((e) => `  - ${e}`);
        const message = [`Unable to decode '${json}'`]
          .concat(subErrors)
          .join("\n");
        return new Error(message);
      }),
    );
  }
}

export { Event, EventStateChanged, HomeAssistant };
