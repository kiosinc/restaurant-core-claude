/*
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { v4 as uuidv4 } from 'uuid'
import * as admin from 'firebase-admin'

const SHARD_COLLECTION_ID = '_counter_shards_'

function getShardId () {
  return uuidv4()
}

async function schedule (func: () => unknown) {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve(func())
    }, 0)
  })
}

export default class Counter {
  private shards: Record<string, number>
  private notifyPromise: Promise<unknown> | null
  private readonly doc: FirebaseFirestore.DocumentReference
  private readonly field: string
  private readonly db: FirebaseFirestore.Firestore
  private readonly shardId: string
  private unsubscribeFns: (() => void)[]

  /**
   * Constructs a sharded counter object that references to a field
   * in a document that is a counter.
   *
   * @param doc A reference to a document with a counter field.
   * @param field A path to a counter field in the above document.
   */
  constructor (doc: FirebaseFirestore.DocumentReference, field: string) {
    this.shards = {}
    this.notifyPromise = null
    this.doc = doc
    this.field = field
    this.db = doc.firestore
    this.shardId = getShardId()
    this.unsubscribeFns = []

    const shardsRef = doc.collection(SHARD_COLLECTION_ID)
    this.shards[doc.path] = 0
    this.shards[shardsRef.doc(this.shardId).path] = 0
    this.shards[shardsRef.doc(`\t${this.shardId.slice(0, 4)}`).path] = 0
    this.shards[shardsRef.doc(`\t\t${this.shardId.slice(0, 3)}`).path] = 0
    this.shards[shardsRef.doc(`\t\t\t${this.shardId.slice(0, 2)}`).path] = 0
    this.shards[shardsRef.doc(`\t\t\t\t${this.shardId.slice(0, 1)}`).path] = 0
  }

  /**
   * Get latency compensated view of the counter.
   *
   * All local increments will be reflected in the counter even if the main
   * counter hasn't been updated yet.
   */
  async get () {
    const valuePromises = Object.keys(this.shards).map(async (path) => {
      const shard = await this.db.doc(path).get()
      return shard.get(this.field) || 0
    })
    const values = await Promise.all(valuePromises)
    return values.reduce((a, b) => a + b, 0)
  }

  /**
   * Listen to latency compensated view of the counter.
   *
   * All local increments to this counter will be immediately visible in the
   * snapshot.
   */
  onSnapshot (observable: (snapshot: { exists: boolean; data: () => number }) => void) {
    this.unsubscribe()
    Object.keys(this.shards).forEach((path) => {
      const unsub = this.db.doc(path).onSnapshot((snap) => {
        this.shards[snap.ref.path] = snap.get(this.field) || 0
        if (this.notifyPromise !== null) return
        this.notifyPromise = schedule(() => {
          const sum = Object.values(this.shards).reduce((a, b) => a + b, 0)
          observable({
            exists: true,
            data: () => sum,
          })
          this.notifyPromise = null
        })
      })
      this.unsubscribeFns.push(unsub)
    })
  }

  unsubscribe () {
    for (const unsub of this.unsubscribeFns) unsub()
    this.unsubscribeFns = []
  }

  /**
   * Increment the counter by a given value.
   *
   * e.g.
   * const counter = new sharded.Counter(db.doc("path/document"), "counter");
   * counter.incrementBy(1);
   */
  incrementBy(val: number) {
    const increment = admin.firestore.FieldValue.increment(val);
    // Builds nested object like { field: { sub: FieldValue } } for dotted field paths
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- FieldValue is the leaf; intermediate steps are Records
    const update = this.field
      .split('.')
      .reverse()
      .reduce<any>((value, name) => ({ [name]: value }), increment);
    return this.doc
      .collection(SHARD_COLLECTION_ID)
      .doc(this.shardId)
      .set(update, { merge: true });
  }

  /**
   * Access the assigned shard directly. Useful to update multiple counters
   * at the same time, batches or transactions.
   *
   * e.g.
   * const counter = new sharded.Counter(db.doc("path/counter"), "");
   * const shardRef = counter.shard();
   * shardRef.set({"counter1", firestore.FieldValue.Increment(1),
   *               "counter2", firestore.FieldValue.Increment(1));
   */
  shard () {
    return this.doc.collection(SHARD_COLLECTION_ID).doc(this.shardId)
  }
}
