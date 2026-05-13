export type Role = "user" | "admin" | "chef" | "delivery" | "supplier" | "manager" | "auditor" | "provider";

export type User = {
  id: number;
  username: string;
  passwordHash: string;
  email: string;
  role: Role;
  createdAt: string;
  updatedAt: string;
};

export type InventoryItem = {
  id: number;
  itemName: string;
  quantity: number;
  expiryDate: string;
  addedBy?: number;
  addedAt: string;
  updatedAt: string;
};

export type DeliveryProvider = {
  id: number;
  providerName: string;
};

export type Order = {
  id: number;
  orderedBy: number | "system";
  orderDate: string;
  status: "pending" | "delivering" | "delivered" | "cancelled";
  deliveryDate?: string;
  supplierId?: number;
  providerId?: number;
  providerName?: string;
};

export type OrderItem = {
  id: number;
  orderId: number;
  itemId: number;
  quantity: number;
};

export type FridgeItem = {
  id: number;
  itemId: number;
  quantity: number;
  expiryDate: string;
};

export type StockUsage = {
  id: number;
  itemName: string;
  quantityUsed: number;
  dateUsed: string;
};

export type ComplianceReport = {
  id: number;
  complianceCheck: string;
  status: string;
  dateChecked: string;
};

export type AccessLog = {
  id: number;
  userId: number;
  accessType: string;
  accessTime: string;
};

export type OrderLog = {
  id: number;
  orderId: number;
  userId: number;
  action: string;
  actionTime: string;
};

export type DataStore = {
  users: User[];
  inventory: InventoryItem[];
  deliveryProviders: DeliveryProvider[];
  orders: Order[];
  orderItems: OrderItem[];
  fridge: FridgeItem[];
  stockUsage: StockUsage[];
  complianceReports: ComplianceReport[];
  accessLogs: AccessLog[];
  orderLogs: OrderLog[];
};
