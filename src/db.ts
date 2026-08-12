import { randomBytes } from "node:crypto";
import { MongoClient, type Collection, type Document } from "mongodb";

export function randomId(): string {
  return randomBytes(8).toString("hex");
}

export interface User {
  id: string;
  email: string;
  passwordHash: string;
  salt: string;
  createdAt: number;
  googleSub?: string;
}

export interface OwnedPositionRec {
  address: string;
  chainId: string;
  message: string;
  signature: string;
  registeredAt: number;
  ownerId?: string;
}

export type CredentialType = "keeperhub-api-key" | "rescue-wallet-key";

export interface CredentialRec {
  id: string;
  userId: string;
  name: string;
  type: CredentialType;
  valueEnc: string;
  createdAt: number;
}

export interface PluginRec {
  id: string;
  userId: string;
  chainId: string;
  protocol: string;
  enabled: boolean;
  criticalHf: number;
  targetHf: number;
  updatedAt: number;
}

export type ApprovalStatus = "pending" | "approved" | "rejected" | "timeout";

export interface ApprovalRec {
  id: string;
  chainId: string;
  user: string;
  taskId: string;
  summary: string;
  payload: unknown;
  createdAt: number;
  status: ApprovalStatus;
  resolvedAt?: number;
  resolvedBy?: string;
  ownerId?: string;
}

export interface AgentActivityRec {
  id: string;
  agent: string;
  tool: string;
  args: string;
  ok: boolean;
  ms: number;
  at: number;
}

export interface Store {
  findUserByEmail(email: string): Promise<User | null>;
  findUserById(id: string): Promise<User | null>;
  createUser(user: User): Promise<void>;

  ownedPositions(): Promise<OwnedPositionRec[]>;
  listPositionsForOwner(ownerId: string): Promise<OwnedPositionRec[]>;
  ownsPosition(chainId: string, address: string): Promise<boolean>;
  addPosition(pos: OwnedPositionRec): Promise<void>;

  listCredentials(userId: string): Promise<CredentialRec[]>;
  upsertCredential(cred: CredentialRec): Promise<void>;
  deleteCredential(userId: string, id: string): Promise<boolean>;

  listPlugins(userId: string): Promise<PluginRec[]>;
  upsertPlugin(plugin: PluginRec): Promise<void>;
  deletePlugin(userId: string, id: string): Promise<boolean>;

  createApproval(a: ApprovalRec): Promise<void>;
  findApproval(id: string): Promise<ApprovalRec | null>;
  listApprovals(filter: { ownerId?: string; status?: ApprovalStatus }): Promise<ApprovalRec[]>;
  resolveApproval(id: string, status: Exclude<ApprovalStatus, "pending">, resolvedBy?: string): Promise<void>;

  recordActivity(a: AgentActivityRec): Promise<void>;
  listActivity(limit: number): Promise<AgentActivityRec[]>;
}

/* ------------------------------------------------------------------ */
/* in-memory fallback (local dev without a Mongo cluster)              */
/* ------------------------------------------------------------------ */

class MemoryStore implements Store {
  private users: User[] = [];
  private positions: OwnedPositionRec[] = [];
  private credentials: CredentialRec[] = [];
  private plugins: PluginRec[] = [];
  private approvals: ApprovalRec[] = [];
  private activity: AgentActivityRec[] = [];

  async findUserByEmail(email: string): Promise<User | null> {
    return this.users.find((u) => u.email === email.toLowerCase()) ?? null;
  }
  async findUserById(id: string): Promise<User | null> {
    return this.users.find((u) => u.id === id) ?? null;
  }
  async createUser(user: User): Promise<void> {
    this.users.push(user);
  }

  async ownedPositions(): Promise<OwnedPositionRec[]> {
    return [...this.positions];
  }
  async listPositionsForOwner(ownerId: string): Promise<OwnedPositionRec[]> {
    return this.positions.filter((p) => p.ownerId === ownerId);
  }
  async ownsPosition(chainId: string, address: string): Promise<boolean> {
    return this.positions.some(
      (p) => p.chainId === chainId && p.address.toLowerCase() === address.toLowerCase()
    );
  }
  async addPosition(pos: OwnedPositionRec): Promise<void> {
    this.positions = this.positions.filter(
      (p) => !(p.chainId === pos.chainId && p.address.toLowerCase() === pos.address.toLowerCase())
    );
    this.positions.push(pos);
  }

  async listCredentials(userId: string): Promise<CredentialRec[]> {
    return this.credentials.filter((c) => c.userId === userId);
  }
  async upsertCredential(cred: CredentialRec): Promise<void> {
    this.credentials = this.credentials.filter((c) => !(c.userId === cred.userId && c.id === cred.id));
    this.credentials.push(cred);
  }
  async deleteCredential(userId: string, id: string): Promise<boolean> {
    const before = this.credentials.length;
    this.credentials = this.credentials.filter((c) => !(c.userId === userId && c.id === id));
    return this.credentials.length < before;
  }

  async listPlugins(userId: string): Promise<PluginRec[]> {
    return this.plugins.filter((p) => p.userId === userId);
  }
  async upsertPlugin(plugin: PluginRec): Promise<void> {
    this.plugins = this.plugins.filter(
      (p) => !(p.userId === plugin.userId && p.chainId === plugin.chainId && p.protocol === plugin.protocol)
    );
    this.plugins.push(plugin);
  }
  async deletePlugin(userId: string, id: string): Promise<boolean> {
    const before = this.plugins.length;
    this.plugins = this.plugins.filter((p) => !(p.userId === userId && p.id === id));
    return this.plugins.length < before;
  }

  async createApproval(a: ApprovalRec): Promise<void> {
    this.approvals = this.approvals.filter((x) => x.id !== a.id);
    this.approvals.push(a);
  }
  async findApproval(id: string): Promise<ApprovalRec | null> {
    return this.approvals.find((a) => a.id === id) ?? null;
  }
  async listApprovals(filter: { ownerId?: string; status?: ApprovalStatus }): Promise<ApprovalRec[]> {
    return this.approvals
      .filter((a) => (filter.ownerId ? a.ownerId === filter.ownerId : true))
      .filter((a) => (filter.status ? a.status === filter.status : true))
      .sort((a, b) => b.createdAt - a.createdAt);
  }
  async resolveApproval(
    id: string,
    status: Exclude<ApprovalStatus, "pending">,
    resolvedBy?: string
  ): Promise<void> {
    const a = this.approvals.find((x) => x.id === id);
    if (a && a.status === "pending") {
      a.status = status;
      a.resolvedAt = Date.now();
      a.resolvedBy = resolvedBy;
    }
  }

  async recordActivity(a: AgentActivityRec): Promise<void> {
    this.activity.push(a);
    if (this.activity.length > 200) this.activity = this.activity.slice(-200);
  }
  async listActivity(limit: number): Promise<AgentActivityRec[]> {
    return this.activity.slice(-limit).reverse();
  }
}

/* ------------------------------------------------------------------ */
/* MongoDB Atlas                                                       */
/* ------------------------------------------------------------------ */

class MongoStore implements Store {
  private constructor(private db: { collection(name: string): Collection<Document> }) {}

  static async connect(uri: string): Promise<MongoStore> {
    const client = new MongoClient(uri, { serverSelectionTimeoutMS: 5000 });
    await client.connect();
    const dbName = process.env.MONGODB_DB ?? "solvency_sentinel";
    const db = client.db(dbName);
    for (const name of [
      "users",
      "positions",
      "credentials",
      "plugins",
      "approvals",
      "agent_activity",
    ]) {
      await db.collection(name).createIndex({ id: 1 }, { unique: true });
    }
    return new MongoStore(db);
  }

  private async findOne(coll: string, filter: Document): Promise<Document | null> {
    return this.db.collection(coll).findOne(filter);
  }
  private async toArray(coll: string, filter: Document, limit?: number): Promise<Document[]> {
    let cursor = this.db.collection(coll).find(filter);
    if (limit !== undefined) cursor = cursor.limit(limit);
    return cursor.toArray();
  }
  private async put(coll: string, doc: Document, key: Document): Promise<void> {
    await this.db.collection(coll).replaceOne(key, doc, { upsert: true });
  }

  async findUserByEmail(email: string): Promise<User | null> {
    const d = await this.findOne("users", { email: email.toLowerCase() });
    return d ? (d as unknown as User) : null;
  }
  async findUserById(id: string): Promise<User | null> {
    const d = await this.findOne("users", { id });
    return d ? (d as unknown as User) : null;
  }
  async createUser(user: User): Promise<void> {
    await this.put("users", user as unknown as Document, { id: user.id });
  }

  async ownedPositions(): Promise<OwnedPositionRec[]> {
    return (await this.toArray("positions", {})).map((d) => d as unknown as OwnedPositionRec);
  }
  async listPositionsForOwner(ownerId: string): Promise<OwnedPositionRec[]> {
    return (await this.toArray("positions", { ownerId })).map(
      (d) => d as unknown as OwnedPositionRec
    );
  }
  async ownsPosition(chainId: string, address: string): Promise<boolean> {
    const d = await this.findOne("positions", {
      chainId,
      address: { $regex: `^${address.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, $options: "i" },
    });
    return !!d;
  }
  async addPosition(pos: OwnedPositionRec): Promise<void> {
    await this.db.collection("positions").deleteOne({
      chainId: pos.chainId,
      address: { $regex: `^${pos.address.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, $options: "i" },
    });
    await this.put("positions", pos as unknown as Document, { id: pos.address + ":" + pos.chainId });
  }

  async listCredentials(userId: string): Promise<CredentialRec[]> {
    return (await this.toArray("credentials", { userId })).map((d) => d as unknown as CredentialRec);
  }
  async upsertCredential(cred: CredentialRec): Promise<void> {
    await this.put("credentials", cred as unknown as Document, { id: cred.id });
  }
  async deleteCredential(userId: string, id: string): Promise<boolean> {
    const r = await this.db.collection("credentials").deleteOne({ userId, id });
    return (r.deletedCount ?? 0) > 0;
  }

  async listPlugins(userId: string): Promise<PluginRec[]> {
    return (await this.toArray("plugins", { userId })).map((d) => d as unknown as PluginRec);
  }
  async upsertPlugin(plugin: PluginRec): Promise<void> {
    await this.put("plugins", plugin as unknown as Document, {
      userId: plugin.userId,
      chainId: plugin.chainId,
      protocol: plugin.protocol,
    });
  }
  async deletePlugin(userId: string, id: string): Promise<boolean> {
    const r = await this.db.collection("plugins").deleteOne({ userId, id });
    return (r.deletedCount ?? 0) > 0;
  }

  async createApproval(a: ApprovalRec): Promise<void> {
    await this.put("approvals", a as unknown as Document, { id: a.id });
  }
  async findApproval(id: string): Promise<ApprovalRec | null> {
    const d = await this.findOne("approvals", { id });
    return d ? (d as unknown as ApprovalRec) : null;
  }
  async listApprovals(filter: { ownerId?: string; status?: ApprovalStatus }): Promise<ApprovalRec[]> {
    const q: Document = {};
    if (filter.ownerId) q.ownerId = filter.ownerId;
    if (filter.status) q.status = filter.status;
    return (await this.toArray("approvals", q)).map((d) => d as unknown as ApprovalRec);
  }
  async resolveApproval(
    id: string,
    status: Exclude<ApprovalStatus, "pending">,
    resolvedBy?: string
  ): Promise<void> {
    await this.db.collection("approvals").updateOne(
      { id, status: "pending" },
      { $set: { status, resolvedAt: Date.now(), ...(resolvedBy ? { resolvedBy } : {}) } }
    );
  }

  async recordActivity(a: AgentActivityRec): Promise<void> {
    await this.put("agent_activity", a as unknown as Document, { id: a.id });
    const count = await this.db.collection("agent_activity").countDocuments();
    if (count > 200) {
      const oldest = await this.toArray("agent_activity", {}, count - 200);
      const ids = oldest.map((d) => d.id);
      await this.db.collection("agent_activity").deleteMany({ id: { $in: ids } });
    }
  }
  async listActivity(limit: number): Promise<AgentActivityRec[]> {
    return (
      await this.db
        .collection("agent_activity")
        .find({})
        .sort({ at: -1 })
        .limit(limit)
        .toArray()
    ).map((d) => d as unknown as AgentActivityRec);
  }
}

/* ------------------------------------------------------------------ */

let storeInstance: Store | undefined;
let storeInit: Promise<Store> | undefined;

function memoryStore(): Store {
  return new MemoryStore();
}

/**
 * Returns the shared store. MongoDB Atlas when MONGODB_URI is set, otherwise an
 * in-memory store (single shared instance — state is lost on restart).
 */
export async function getStore(): Promise<Store> {
  if (storeInstance) return storeInstance;
  const uri = process.env.MONGODB_URI ?? "";
  if (uri) {
    if (!storeInit) {
      storeInit = MongoStore.connect(uri)
        .then((s) => {
          console.error("[db] connected to MongoDB Atlas");
          storeInstance = s;
          return s;
        })
        .catch((err) => {
          console.error("[db] MongoDB unavailable, falling back to in-memory store:", (err as Error).message);
          storeInstance = memoryStore();
          return storeInstance;
        });
    }
    return storeInit;
  }
  console.error("[db] MONGODB_URI not set — using in-memory store (state resets on restart)");
  storeInstance = memoryStore();
  return storeInstance;
}
