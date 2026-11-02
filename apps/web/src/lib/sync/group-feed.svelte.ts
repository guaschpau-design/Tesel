// The live picture of one group and what this device does in it. Its log, kept in sync with the
// group's server and radio, is a GroupSync (group-sync.svelte.ts); the events of each action are
// built in member-events.ts. Components read `state` and `status`.

import type { GroupState, LoraEvent } from '@tesel/core';
import type {
  EventRef,
  LatLon,
  MarkerEvent,
  ObjectRef,
  ShapeEvent,
  ShapeGeometry,
  SosKind,
} from '@tesel/protocol';

import type { StoredGroup } from '../groups/group.ts';
import { setChatSeen } from '../groups/group-store.ts';
import type { LocalIdentity } from '../identity/identity.ts';
import type { Heard } from '../links/heard.ts';
import type { DeviceFix } from '../position/device-location.svelte.ts';
import type { AppDb } from '../storage/app-db.ts';
import { storageRefusals } from '../storage/storage-space.svelte.ts';
import type { TaskFields } from '../tasks/tasks.ts';
import {
  isUntold,
  sameState,
  type MemberStateFields,
  type ReportFields,
  type TeamFields,
} from './event-fields.ts';
import { GroupSync, type Delivery, type FeedStatus } from './group-sync.svelte.ts';
import type { LogImport } from './log-file.ts';
import type { LoraSink } from './lora-events.ts';
import {
  ack,
  chat,
  checkInTimer,
  editedObject,
  memberInfo,
  memberState,
  newMarker,
  newShape,
  objectDelete,
  position,
  positionHidden,
  report,
  restyledShape,
  sos,
  sosCancel,
  sweepStrip,
  task,
  team,
} from './member-events.ts';
import type { SocketLike } from './relay-types.ts';

export class GroupFeed {
  /** How many chat lines and reports of others this device has shown (chat/unread.ts). */
  chatSeen = $state(0);

  readonly #db: AppDb;
  readonly #group: StoredGroup;
  #identity: LocalIdentity;
  readonly #sync: GroupSync;

  private constructor(db: AppDb, group: StoredGroup, identity: LocalIdentity, sync: GroupSync) {
    this.#db = db;
    this.#group = group;
    this.chatSeen = group.chatSeen ?? 0;
    this.#identity = identity;
    this.#sync = sync;
  }

  /**
   * Loads the group's log, announces this member if needed and connects to the server. Loading
   * forgets what the log holds and the state has outlived, as after any batch (ADR-0055). Tests
   * pass `createSocket` to stand in for the relay.
   */
  static async open(
    db: AppDb,
    group: StoredGroup,
    identity: LocalIdentity,
    createSocket?: (url: string) => SocketLike,
  ): Promise<GroupFeed> {
    const sync = await GroupSync.load(db, group, identity.nodeId, createSocket);
    const feed = new GroupFeed(db, group, identity, sync);
    // Opening does not depend on announcing: a device whose storage is full still shows the group.
    await feed.#announceSelf().catch((error: unknown) => {
      storageRefusals.note(error);
      console.warn('Announcing this device to the group failed', error);
    });
    sync.connect();
    return feed;
  }

  get state(): GroupState {
    return this.#sync.state;
  }

  get status(): FeedStatus {
    return this.#sync.status;
  }

  /** What this device has heard from each member, by channel, since the feed opened. */
  get heard(): Heard {
    return this.#sync.heard;
  }

  /** Own events neither stored by a relay nor put on the air, by event reference key. */
  get undelivered(): ReadonlySet<string> {
    return this.#sync.undelivered;
  }

  get delivery(): Delivery {
    return this.#sync.delivery;
  }

  get groupId(): string {
    return this.#group.id;
  }

  get groupName(): string {
    return this.#group.name;
  }

  /** The radio channel of the group: its name and secret (protocol §7). */
  get radioChannel(): { readonly name: string; readonly secret: Uint8Array } {
    return { name: this.#group.name, secret: this.#group.secret };
  }

  /** Connects the feed to a radio, or disconnects it with null (`GroupSync.attachRadio`). */
  attachRadio(sink: LoraSink | null): Promise<void> {
    return this.#sync.attachRadio(sink);
  }

  /** An event this device put on the air. */
  radioSent(event: LoraEvent): Promise<void> {
    return this.#sync.radioSent(event);
  }

  /** An event heard over the radio. */
  receiveFromRadio(bytes: Uint8Array): Promise<void> {
    return this.#sync.receiveFromRadio(bytes);
  }

  /** The group's log as a log file. */
  exportLog(): Promise<string> {
    return this.#sync.exportLog();
  }

  /** Takes the events of a log file of this group that this device is missing. */
  importLog(text: string): Promise<LogImport> {
    return this.#sync.importLog(text);
  }

  close(): void {
    this.#sync.close();
  }

  /** The chat has been shown up to `seen` lines and reports of others; kept for the next visit. */
  async markChatSeen(seen: number): Promise<void> {
    if (seen === this.chatSeen) return;
    this.chatSeen = seen;
    await setChatSeen(this.#db, this.#group.id, seen);
  }

  /** Whether the group sees this device's position: it shared one and has not hidden it since. */
  get showsOwnPosition(): boolean {
    return this.state.positions.get(this.#identity.nodeId)?.type === 'position';
  }

  async sendChat(text: string): Promise<void> {
    await this.#sync.publish(chat(text));
  }

  async sharePosition(fix: DeviceFix): Promise<void> {
    await this.#sync.publish(position(fix));
  }

  /** Tells the group to stop showing this device's position; returns the event's reference. */
  hidePosition(): Promise<EventRef> {
    return this.#sync.publish(positionHidden());
  }

  async placeMarker(at: LatLon, symbol: number, label: string): Promise<void> {
    await this.#sync.publish(newMarker(at, symbol, label));
  }

  async drawShape(geometry: ShapeGeometry, style: number, label: string): Promise<void> {
    await this.#sync.publish(newShape(geometry, style, label));
  }

  async restyleShape(shape: ShapeEvent, style: number): Promise<void> {
    await this.#sync.publish(restyledShape(shape, style));
  }

  /** Creates one strip of a sweep of `area` and returns its object reference. */
  async addSweepStrip(
    area: ObjectRef,
    recipe: { readonly spacing: number; readonly heading: number },
    strip: number,
    strips: number,
  ): Promise<ObjectRef> {
    return this.#sync.publish(sweepStrip(area, recipe, strip, strips));
  }

  /** Changes the label and the symbol or style of a marker or a shape, keeping where it is. */
  async editObject(record: MarkerEvent | ShapeEvent, code: number, label: string): Promise<void> {
    await this.#sync.publish(editedObject(record, code, label));
  }

  async deleteObject(object: ObjectRef): Promise<void> {
    await this.#sync.publish(objectDelete(object));
  }

  /** Calls for help, from `at` if this device has a position; returns the call's reference. */
  sendSos(
    kind: SosKind,
    at: LatLon | null,
    accuracy: number | null,
    text: string,
  ): Promise<EventRef> {
    return this.#sync.publish(sos(kind, at, accuracy, text));
  }

  async cancelSos(call: EventRef): Promise<void> {
    await this.#sync.publish(sosCancel(call));
  }

  async acknowledge(target: EventRef): Promise<void> {
    await this.#sync.publish(ack(target));
  }

  /** Creates a task, or changes the task `ref` refers to. */
  async writeTask(ref: EventRef | null, fields: TaskFields): Promise<void> {
    await this.#sync.publish(task(ref, fields));
  }

  /**
   * Tells the group this device's profile, status, battery and equipment (protocol §3.14), unless
   * it knows them already; nothing is sent for a device that never set any of them.
   */
  async shareState(state: MemberStateFields): Promise<void> {
    const known = this.state.memberStates.get(this.#identity.nodeId);
    if (known === undefined ? isUntold(state) : sameState(known, state)) return;
    await this.#sync.publish(memberState(state));
  }

  /** Turns the group's safety check-in on after `minutes`, or off with 0. */
  async setCheckInTimer(minutes: number): Promise<void> {
    await this.#sync.publish(checkInTimer(minutes));
  }

  async sendReport(fields: ReportFields): Promise<void> {
    await this.#sync.publish(report(fields));
  }

  /** Creates or changes a team. */
  async writeTeam(fields: TeamFields): Promise<void> {
    await this.#sync.publish(team(fields));
  }

  /** This device goes by another name from now on: the group is told (MEMBER_INFO). */
  async rename(alias: string): Promise<void> {
    this.#identity = { ...this.#identity, alias };
    await this.#announceSelf();
  }

  /** Publishes MEMBER_INFO if the group does not know this device's current alias and role. */
  async #announceSelf(): Promise<void> {
    const known = this.state.members.get(this.#identity.nodeId);
    if (known?.alias === this.#identity.alias && known.role === this.#group.role) return;
    await this.#sync.publish(memberInfo(this.#group.role, this.#identity));
  }
}
