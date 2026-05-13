import { NextRequest, NextResponse } from "next/server";
import { createSessionToken, getCurrentUser, sessionCookieName } from "../../../lib/auth";
import { formNumber, formString } from "../../../lib/forms";
import { dateOnly, defaultOrderItems, hashPassword, nextId, nowIso, randomExpiryDate, readData, refreshOrderStatuses, roles, updateData, verifyPassword } from "../../../lib/store";
import type { DataStore, Role } from "../../../lib/types";

type RouteContext = {
  params: Promise<{ action: string[] }>;
};

function pathFrom(context: RouteContext) {
  return context.params.then((params) => params.action.join("/"));
}

function redirectTo(request: NextRequest, pathname: string, params?: Record<string, string>) {
  const url = new URL(pathname, request.url);
  Object.entries(params || {}).forEach(([key, value]) => url.searchParams.set(key, value));
  return NextResponse.redirect(url);
}

function activeOrder(data: DataStore) {
  return data.orders
    .filter((order) => order.status === "pending" || order.status === "delivering")
    .sort((a, b) => new Date(b.orderDate).getTime() - new Date(a.orderDate).getTime())[0];
}

async function jsonBody(request: NextRequest) {
  const contentType = request.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    return request.json();
  }
  return Object.fromEntries((await request.formData()).entries());
}

function roleAllowed(role: Role, allowed: Role[]) {
  return allowed.includes(role);
}

async function requireApiUser(request: NextRequest, allowed?: Role[]) {
  const user = await getCurrentUser();
  if (!user) {
    return { user: null, response: redirectTo(request, "/login") };
  }
  if (allowed && !roleAllowed(user.role, allowed)) {
    return { user: null, response: redirectTo(request, "/unauthorized") };
  }
  return { user, response: null };
}

export async function GET(request: NextRequest, context: RouteContext) {
  const action = await pathFrom(context);
  if (action === "auth/logout") {
    const response = redirectTo(request, "/login");
    response.cookies.set(sessionCookieName(), "", {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 0
    });
    return response;
  }
  if (action === "inventory") {
    return NextResponse.json(readData().inventory);
  }
  if (action === "orders") {
    return NextResponse.json(readData().orders);
  }
  if (action === "users") {
    return NextResponse.json(readData().users.map(({ passwordHash, ...user }) => user));
  }
  return NextResponse.json({ message: "Not found" }, { status: 404 });
}

export async function POST(request: NextRequest, context: RouteContext) {
  const action = await pathFrom(context);
  if (action === "auth/login") {
    const formData = await request.formData();
    const username = formString(formData, "username");
    const password = formString(formData, "password");
    const user = updateData((data) => {
      const found = data.users.find((entry) => entry.username === username);
      if (found && verifyPassword(password, found.passwordHash)) {
        data.accessLogs.push({ id: nextId(data.accessLogs), userId: found.id, accessType: "login", accessTime: nowIso() });
        return found;
      }
      return null;
    });
    if (!user) {
      return redirectTo(request, "/login", { error: "Invalid username or password." });
    }
    const response = redirectTo(request, "/dashboard");
    response.cookies.set(sessionCookieName(), createSessionToken(user.id), {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 7
    });
    return response;
  }
  if (action === "auth/signup") {
    const formData = await request.formData();
    const username = formString(formData, "username");
    const password = formString(formData, "password");
    const email = formString(formData, "email");
    const role = formString(formData, "role") as Role;
    if (!username || !password || !email || !roles.includes(role)) {
      return redirectTo(request, "/signup", { error: "Please complete every field." });
    }
    const result = updateData((data) => {
      if (data.users.some((user) => user.username === username)) {
        return { userId: 0, error: "Username already exists." };
      }
      if (data.users.some((user) => user.email === email)) {
        return { userId: 0, error: "Email already exists." };
      }
      const userId = nextId(data.users);
      const timestamp = nowIso();
      data.users.push({ id: userId, username, passwordHash: hashPassword(password), email, role, createdAt: timestamp, updatedAt: timestamp });
      return { userId, error: "" };
    });
    if (result.error) {
      return redirectTo(request, "/signup", { error: result.error });
    }
    const response = redirectTo(request, "/dashboard");
    response.cookies.set(sessionCookieName(), createSessionToken(result.userId), {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 7
    });
    return response;
  }
  if (action === "settings") {
    const { user, response } = await requireApiUser(request);
    if (response || !user) {
      return response;
    }
    const formData = await request.formData();
    const username = formString(formData, "username");
    const password = formString(formData, "password");
    const result = updateData((data) => {
      if (data.users.some((entry) => entry.username === username && entry.id !== user.id)) {
        return "Username is already taken.";
      }
      const current = data.users.find((entry) => entry.id === user.id);
      if (current) {
        current.username = username;
        current.updatedAt = nowIso();
        if (password) {
          current.passwordHash = hashPassword(password);
        }
      }
      return "";
    });
    return redirectTo(request, "/settings", result ? { error: result } : { message: "Account details updated successfully." });
  }
  if (action === "admin/users") {
    const { user, response } = await requireApiUser(request, ["admin"]);
    if (response || !user) {
      return response;
    }
    const formData = await request.formData();
    const intent = formString(formData, "intent");
    const username = formString(formData, "username");
    const email = formString(formData, "email");
    const role = formString(formData, "role") as Role;
    const password = formString(formData, "password");
    if (!roles.includes(role)) {
      return redirectTo(request, "/admin", { error: "Invalid role." });
    }
    const result = updateData((data) => {
      if (intent === "create") {
        if (data.users.some((entry) => entry.email === email)) {
          return "Error: Email already exists.";
        }
        if (data.users.some((entry) => entry.username === username)) {
          return "Error: Username already exists.";
        }
        const timestamp = nowIso();
        data.users.push({ id: nextId(data.users), username, passwordHash: hashPassword(password), email, role, createdAt: timestamp, updatedAt: timestamp });
        return "";
      }
      const userId = formNumber(formData, "userId");
      const target = data.users.find((entry) => entry.id === userId);
      if (!target) {
        return "User not found.";
      }
      if (data.users.some((entry) => entry.username === username && entry.id !== userId)) {
        return "Error: Username already exists.";
      }
      if (data.users.some((entry) => entry.email === email && entry.id !== userId)) {
        return "Error: Email already exists.";
      }
      target.username = username;
      target.email = email;
      target.role = role;
      target.updatedAt = nowIso();
      if (password) {
        target.passwordHash = hashPassword(password);
      }
      return "";
    });
    return redirectTo(request, "/admin", result ? { error: result } : { message: intent === "create" ? "User created successfully." : "User details updated successfully." });
  }
  if (action === "fridge") {
    const { user, response } = await requireApiUser(request, ["manager", "chef", "admin"]);
    if (response || !user) {
      return response;
    }
    const formData = await request.formData();
    const intent = formString(formData, "intent");
    const message = updateData((data) => {
      if (intent === "add_item") {
        const timestamp = nowIso();
        data.inventory.push({
          id: nextId(data.inventory),
          itemName: formString(formData, "itemName"),
          quantity: formNumber(formData, "quantity"),
          expiryDate: formString(formData, "expiryDate"),
          addedBy: user.id,
          addedAt: timestamp,
          updatedAt: timestamp
        });
        return "Item added to inventory successfully.";
      }
      if (intent === "remove_item") {
        const itemId = formNumber(formData, "itemId");
        data.orderItems = data.orderItems.filter((item) => item.itemId !== itemId);
        data.fridge = data.fridge.filter((item) => item.itemId !== itemId);
        data.inventory = data.inventory.filter((item) => item.id !== itemId);
        return "Item removed successfully.";
      }
      if (intent === "use_item") {
        const itemId = formNumber(formData, "itemId");
        const quantityUsed = formNumber(formData, "quantityUsed");
        const item = data.inventory.find((entry) => entry.id === itemId);
        if (!item || quantityUsed < 1 || quantityUsed > item.quantity) {
          return "Unable to use that quantity.";
        }
        item.quantity -= quantityUsed;
        item.updatedAt = nowIso();
        data.stockUsage.push({ id: nextId(data.stockUsage), itemName: item.itemName, quantityUsed, dateUsed: dateOnly(new Date()) });
        return "Stock usage logged.";
      }
      if (intent === "add_compliance_report") {
        data.complianceReports.push({
          id: nextId(data.complianceReports),
          complianceCheck: formString(formData, "complianceCheck"),
          status: formString(formData, "status"),
          dateChecked: formString(formData, "dateChecked")
        });
        return "Compliance report added.";
      }
      return "No action was taken.";
    });
    return redirectTo(request, "/fridge", message === "Unable to use that quantity." ? { error: message } : { message });
  }
  if (action === "track") {
    const { user, response } = await requireApiUser(request, ["chef", "provider", "admin", "delivery", "supplier", "manager"]);
    if (response || !user) {
      return response;
    }
    const formData = await request.formData();
    const intent = formString(formData, "intent");
    const result = updateData((data) => {
      refreshOrderStatuses(data);
      const order = activeOrder(data);
      if (intent === "create_order") {
        if (order) {
          return { message: "", error: "There is already a current order." };
        }
        const providerId = formNumber(formData, "providerId");
        const provider = data.deliveryProviders.find((entry) => entry.id === providerId) || data.deliveryProviders[0];
        const orderId = nextId(data.orders);
        data.orders.push({ id: orderId, orderedBy: user.id, orderDate: nowIso(), status: "pending", providerId: provider.id, providerName: provider.providerName });
        data.orderLogs.push({ id: nextId(data.orderLogs), orderId, userId: user.id, action: "create_order", actionTime: nowIso() });
        defaultOrderItems().forEach((item) => {
          let inventoryItem = data.inventory.find((entry) => entry.itemName.toLowerCase() === item.itemName.toLowerCase());
          if (!inventoryItem) {
            const timestamp = nowIso();
            inventoryItem = { id: nextId(data.inventory), itemName: item.itemName, quantity: 0, expiryDate: randomExpiryDate(), addedBy: user.id, addedAt: timestamp, updatedAt: timestamp };
            data.inventory.push(inventoryItem);
          }
          data.orderItems.push({ id: nextId(data.orderItems), orderId, itemId: inventoryItem.id, quantity: item.quantity });
        });
        return { message: "Order created successfully.", error: "" };
      }
      if (!order) {
        return { message: "", error: "No current order." };
      }
      if (intent === "cancel_order") {
        order.status = "cancelled";
        data.orderLogs.push({ id: nextId(data.orderLogs), orderId: order.id, userId: user.id, action: "cancel_order", actionTime: nowIso() });
        return { message: "Order cancelled.", error: "" };
      }
      if (intent === "add_item") {
        if (order.status === "delivering") {
          return { message: "", error: "Delivering orders cannot be changed." };
        }
        const itemName = formString(formData, "itemName");
        const quantity = formNumber(formData, "quantity");
        let item = data.inventory.find((entry) => entry.itemName.toLowerCase() === itemName.toLowerCase());
        if (!item) {
          const timestamp = nowIso();
          item = { id: nextId(data.inventory), itemName, quantity, expiryDate: randomExpiryDate(), addedBy: user.id, addedAt: timestamp, updatedAt: timestamp };
          data.inventory.push(item);
        }
        data.orderItems.push({ id: nextId(data.orderItems), orderId: order.id, itemId: item.id, quantity });
        data.orderLogs.push({ id: nextId(data.orderLogs), orderId: order.id, userId: user.id, action: "add_item", actionTime: nowIso() });
        return { message: "Item added to order.", error: "" };
      }
      return { message: "", error: "No action was taken." };
    });
    return redirectTo(request, "/track", result.error ? { error: result.error } : { message: result.message });
  }
  if (action === "inventory") {
    const body = await jsonBody(request);
    const itemName = typeof body.item_name === "string" ? body.item_name : typeof body.itemName === "string" ? body.itemName : "";
    const expiryDate = typeof body.expiry_date === "string" ? body.expiry_date : typeof body.expiryDate === "string" ? body.expiryDate : "";
    const quantity = Number(body.quantity);
    const addedBy = Number(body.added_by || body.addedBy || 1);
    if (!itemName || !expiryDate || !Number.isFinite(quantity)) {
      return NextResponse.json({ message: "Invalid inventory item" }, { status: 400 });
    }
    updateData((data) => {
      const timestamp = nowIso();
      data.inventory.push({ id: nextId(data.inventory), itemName, quantity, expiryDate, addedBy, addedAt: timestamp, updatedAt: timestamp });
    });
    return NextResponse.json({ message: "Item added to inventory" }, { status: 201 });
  }
  if (action === "orders") {
    const body = await jsonBody(request);
    const orderedBy = Number(body.ordered_by || body.orderedBy || 1);
    const status = typeof body.status === "string" ? body.status : "pending";
    const supplierId = Number(body.supplier_id || body.supplierId || 0);
    updateData((data) => {
      data.orders.push({ id: nextId(data.orders), orderedBy, status, supplierId: supplierId || undefined, orderDate: nowIso() });
    });
    return NextResponse.json({ message: "Order created successfully" }, { status: 201 });
  }
  if (action === "users") {
    const body = await jsonBody(request);
    const username = typeof body.username === "string" ? body.username : "";
    const password = typeof body.password === "string" ? body.password : "";
    const email = typeof body.email === "string" ? body.email : "";
    const role = (typeof body.role === "string" ? body.role : "user") as Role;
    if (!username || !password || !email || !roles.includes(role)) {
      return NextResponse.json({ message: "Invalid user" }, { status: 400 });
    }
    const error = updateData((data) => {
      if (data.users.some((user) => user.username === username || user.email === email)) {
        return "User already exists";
      }
      const timestamp = nowIso();
      data.users.push({ id: nextId(data.users), username, passwordHash: hashPassword(password), email, role, createdAt: timestamp, updatedAt: timestamp });
      return "";
    });
    if (error) {
      return NextResponse.json({ message: error }, { status: 409 });
    }
    return NextResponse.json({ message: "User created successfully" }, { status: 201 });
  }
  return NextResponse.json({ message: "Not found" }, { status: 404 });
}
