import * as t from "io-ts";

const EntityState = t.type({
  state: t.string,
});

const EventCallService = t.type({
  event_type: t.literal("call_service"), // eslint-disable-line @typescript-eslint/camelcase
});
export const EventStateChanged = t.type({
  event_type: t.literal("state_changed"), // eslint-disable-line @typescript-eslint/camelcase
  data: t.type({
    entity_id: t.string, // eslint-disable-line @typescript-eslint/camelcase
    old_state: EntityState, // eslint-disable-line @typescript-eslint/camelcase
    new_state: EntityState, // eslint-disable-line @typescript-eslint/camelcase
  }),
});
export type EventStateChanged = t.TypeOf<typeof EventStateChanged>;

export const Event = t.union([EventCallService, EventStateChanged]);
export type Event = t.TypeOf<typeof Event>;

export const Message = t.union([
  t.type({
    type: t.keyof({
      auth_required: null, // eslint-disable-line @typescript-eslint/camelcase
      auth_ok: null, // eslint-disable-line @typescript-eslint/camelcase
      result: null,
    }),
  }),
  t.type({
    type: t.literal("event"),
    event: Event,
  }),
]);
export type Message = t.TypeOf<typeof Message>;
