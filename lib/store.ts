import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import type { DataStore, DeliveryProvider, InventoryItem, Order, Role, User } from "./types";

const dataDir = path.join(process.cwd(), ".data");
const sqlitePath = path.join(dataDir, "future_fridge.sqlite");
const legacyJsonPath = path.join(dataDir, "db.json");
let database: DatabaseSync | null = null;

const defaultItems = [
  { itemName: "Tomatoes", quantity: 10 },
  { itemName: "Potatoes", quantity: 20 },
  { itemName: "Onions", quantity: 15 },
  { itemName: "Carrots", quantity: 12 },
  { itemName: "Broccoli", quantity: 8 },
  { itemName: "Spinach", quantity: 5 },
  { itemName: "Chicken Breast", quantity: 10 },
  { itemName: "Ground Beef", quantity: 15 },
  { itemName: "Pork Chops", quantity: 10 },
  { itemName: "Salmon Fillets", quantity: 8 },
  { itemName: "Shrimp", quantity: 20 },
  { itemName: "Apples", quantity: 25 },
  { itemName: "Bananas", quantity: 30 },
  { itemName: "Oranges", quantity: 20 },
  { itemName: "Grapes", quantity: 15 },
  { itemName: "Milk", quantity: 10 },
  { itemName: "Eggs", quantity: 12 },
  { itemName: "Cheese", quantity: 8 }
];

const providerNames = ["DHL", "FedEx", "UPS", "USPS", "Amazon Logistics", "OnTrac", "LaserShip", "TForce", "Purolator", "Canada Post"];

const seededUsers: Array<{ username: string; password: string; email: string; role: Role }> = [
  { username: "admin", password: "admin", email: "admin@example.com", role: "admin" },
  { username: "manager", password: "password", email: "manager@example.com", role: "manager" },
  { username: "chef", password: "password", email: "chef@example.com", role: "chef" },
  { username: "delivery", password: "password", email: "delivery@example.com", role: "delivery" },
  { username: "supplier", password: "password", email: "supplier@example.com", role: "supplier" }
];

export const roles: Role[] = ["user", "admin", "chef", "delivery", "supplier", "manager", "auditor", "provider"];

export function nowIso() {
  return new Date().toISOString();
}

export function dateOnly(date: Date) {
  return date.toISOString().slice(0, 10);
}

export function plusDays(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return dateOnly(date);
}

export function hashPassword(password: string) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, storedHash: string) {
  const [salt, hash] = storedHash.split(":");
  if (!salt || !hash) {
    return false;
  }
  const testHash = crypto.scryptSync(password, salt, 64).toString("hex");
  return crypto.timingSafeEqual(Buffer.from(hash, "hex"), Buffer.from(testHash, "hex"));
}

function initialData(): DataStore {
  const createdAt = nowIso();
  const users: User[] = seededUsers.map((user, index) => ({
    id: index + 1,
    username: user.username,
    passwordHash: hashPassword(user.password),
    email: user.email,
    role: user.role,
    createdAt,
    updatedAt: createdAt
  }));
  const inventory: InventoryItem[] = defaultItems.map((item, index) => ({
    id: index + 1,
    itemName: item.itemName,
    quantity: item.quantity,
    expiryDate: plusDays((index % 10) + 1),
    addedBy: 1,
    addedAt: createdAt,
    updatedAt: createdAt
  }));
  const deliveryProviders: DeliveryProvider[] = providerNames.map((providerName, index) => ({
    id: index + 1,
    providerName
  }));
  const firstOrder: Order = {
    id: 1,
    orderedBy: 2,
    orderDate: new Date(Date.now() - 120000).toISOString(),
    status: "delivering",
    deliveryDate: plusDays(2),
    providerId: 1,
    providerName: "DHL"
  };
  return {
    users,
    inventory,
    deliveryProviders,
    orders: [firstOrder],
    orderItems: [
      { id: 1, orderId: 1, itemId: 1, quantity: 5 },
      { id: 2, orderId: 1, itemId: 6, quantity: 4 },
      { id: 3, orderId: 1, itemId: 16, quantity: 6 }
    ],
    fridge: [],
    stockUsage: [
      { id: 1, itemName: "Tomatoes", quantityUsed: 2, dateUsed: dateOnly(new Date()) }
    ],
    complianceReports: [
      { id: 1, complianceCheck: "Temperature log reviewed", status: "Passed", dateChecked: dateOnly(new Date()) }
    ],
    accessLogs: [],
    orderLogs: []
  };
}

function openDatabase() {
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  if (!database) {
    database = new DatabaseSync(sqlitePath);
    database.exec("CREATE TABLE IF NOT EXISTS app_state (id INTEGER PRIMARY KEY CHECK (id = 1), payload TEXT NOT NULL, updated_at TEXT NOT NULL)");
  }
  return database;
}

function seedData() {
  if (fs.existsSync(legacyJsonPath)) {
    return JSON.parse(fs.readFileSync(legacyJsonPath, "utf8")) as DataStore;
  }
  return initialData();
}

function ensureDatabase() {
  const db = openDatabase();
  const row = db.prepare("SELECT payload FROM app_state WHERE id = 1").get() as { payload: string } | undefined;
  if (!row) {
    const data = seedData();
    db.prepare("INSERT INTO app_state (id, payload, updated_at) VALUES (1, ?, ?)").run(JSON.stringify(data), nowIso());
  }
  return db;
}

export function readData(): DataStore {
  const db = ensureDatabase();
  const row = db.prepare("SELECT payload FROM app_state WHERE id = 1").get() as { payload: string } | undefined;
  return row ? JSON.parse(row.payload) as DataStore : initialData();
}

export function writeData(data: DataStore) {
  const db = ensureDatabase();
  db.prepare("UPDATE app_state SET payload = ?, updated_at = ? WHERE id = 1").run(JSON.stringify(data), nowIso());
}

export function updateData<T>(handler: (data: DataStore) => T) {
  const db = ensureDatabase();
  db.exec("BEGIN IMMEDIATE");
  try {
    const row = db.prepare("SELECT payload FROM app_state WHERE id = 1").get() as { payload: string };
    const data = JSON.parse(row.payload) as DataStore;
    const result = handler(data);
    db.prepare("UPDATE app_state SET payload = ?, updated_at = ? WHERE id = 1").run(JSON.stringify(data), nowIso());
    db.exec("COMMIT");
    return result;
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

export function nextId<T extends { id: number }>(items: T[]) {
  return items.length ? Math.max(...items.map((item) => item.id)) + 1 : 1;
}

export function randomExpiryDate() {
  return plusDays(Math.floor(Math.random() * 14) + 1);
}

export function defaultOrderItems() {
  return defaultItems;
}

export function refreshOrderStatuses(data: DataStore) {
  const current = data.orders
    .filter((order) => order.status === "pending" || order.status === "delivering")
    .sort((a, b) => new Date(b.orderDate).getTime() - new Date(a.orderDate).getTime())[0];
  if (!current) {
    return;
  }
  const ageSeconds = Math.floor((Date.now() - new Date(current.orderDate).getTime()) / 1000);
  if (current.status === "pending" && ageSeconds >= 30) {
    current.status = "delivering";
    current.deliveryDate = plusDays(2);
  }
  if (current.status === "delivering" && current.deliveryDate && Date.now() >= new Date(`${current.deliveryDate}T00:00:00`).getTime()) {
    current.status = "delivered";
    data.orderItems
      .filter((item) => item.orderId === current.id)
      .forEach((item) => {
        const inventoryItem = data.inventory.find((entry) => entry.id === item.itemId);
        if (inventoryItem) {
          inventoryItem.quantity += item.quantity;
          inventoryItem.expiryDate = randomExpiryDate();
          inventoryItem.updatedAt = nowIso();
          data.fridge.push({ id: nextId(data.fridge), itemId: item.itemId, quantity: item.quantity, expiryDate: inventoryItem.expiryDate });
        }
      });
  }
}
