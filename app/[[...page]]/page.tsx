import Link from "next/link";
import { redirect } from "next/navigation";
import { Countdown } from "../../components/Countdown";
import { getCurrentUser, logAccess, requireRole, requireUser } from "../../lib/auth";
import { defaultOrderItems, readData, refreshOrderStatuses, roles, writeData } from "../../lib/store";

type Search = {
  error?: string;
  message?: string;
};

type PageProps = {
  params: Promise<{ page?: string[] }>;
  searchParams: Promise<Search>;
};

function alert(params: Search) {
  return (
    <>
      {params.message ? <div className="alert alert-success">{params.message}</div> : null}
      {params.error ? <div className="alert alert-danger">{params.error}</div> : null}
    </>
  );
}

function expiryIcon(expiryDate: string) {
  const today = new Date();
  const expiry = new Date(`${expiryDate}T00:00:00`);
  const diffDays = Math.ceil((expiry.getTime() - today.getTime()) / 86400000);
  if (diffDays < 0) {
    return <span className="expired-icon" title="Expired!">x</span>;
  }
  if (diffDays <= 1) {
    return <span className="expiry-warning" title="Expiring soon!">!</span>;
  }
  return null;
}

function HomeView() {
  return (
    <main className="container">
      <section className="jumbotron">
        <h1 className="display-4">Welcome to Future Fridges!</h1>
        <p className="lead">Your one-stop solution for managing fridge inventory, orders, and compliance reports.</p>
        <hr className="rule" />
        <p>Use the buttons below to login or access the dashboard.</p>
        <div className="btn-row">
          <Link className="btn btn-primary btn-lg" href="/login">Login</Link>
          <Link className="btn btn-secondary btn-lg" href="/dashboard">Dashboard</Link>
        </div>
      </section>
    </main>
  );
}

async function LoginView(params: Search) {
  if (await getCurrentUser()) {
    redirect("/dashboard");
  }
  return (
    <main className="container narrow">
      <section className="card">
        <div className="card-header">Login</div>
        <div className="card-body">
          {alert(params)}
          <form action="/api/auth/login" method="POST">
            <div className="form-group">
              <label htmlFor="username">Username</label>
              <input className="form-control" id="username" name="username" required />
            </div>
            <div className="form-group">
              <label htmlFor="password">Password</label>
              <input className="form-control" id="password" name="password" type="password" required />
            </div>
            <div className="btn-row">
              <button className="btn btn-primary" type="submit">Login</button>
              <Link className="btn btn-secondary" href="/signup">Sign Up</Link>
            </div>
          </form>
        </div>
      </section>
    </main>
  );
}

function SignupView(params: Search) {
  return (
    <main className="container narrow">
      <section className="card">
        <div className="card-header">Signup</div>
        <div className="card-body">
          {alert(params)}
          <form action="/api/auth/signup" method="POST">
            <div className="form-group">
              <label htmlFor="username">Username</label>
              <input className="form-control" id="username" name="username" required />
            </div>
            <div className="form-group">
              <label htmlFor="password">Password</label>
              <input className="form-control" id="password" name="password" type="password" required />
            </div>
            <div className="form-group">
              <label htmlFor="email">Email</label>
              <input className="form-control" id="email" name="email" type="email" required />
            </div>
            <div className="form-group">
              <label htmlFor="role">Role</label>
              <select className="form-control" id="role" name="role" required>
                {roles.filter((role) => role !== "provider").map((role) => (
                  <option key={role} value={role}>{role[0].toUpperCase() + role.slice(1)}</option>
                ))}
              </select>
            </div>
            <button className="btn btn-primary" name="signup" type="submit">Signup</button>
          </form>
        </div>
      </section>
    </main>
  );
}

async function DashboardView() {
  const user = await requireUser();
  const data = readData();
  return (
    <main className="container stack">
      <section className="card">
        <div className="card-header">Dashboard</div>
        <div className="card-body">
          <p>Welcome, {user.username}!</p>
          <p>Your role: {user.role}</p>
        </div>
      </section>
      <section className="stats-row">
        <article className="card stat-card primary">
          <div className="card-header">Total Orders</div>
          <div className="card-body"><h2>{data.orders.length}</h2></div>
        </article>
        <article className="card stat-card success">
          <div className="card-header">Total Successful Orders</div>
          <div className="card-body"><h2>{data.orders.filter((order) => order.status === "delivered").length}</h2></div>
        </article>
        <article className="card stat-card info">
          <div className="card-header">Total Users</div>
          <div className="card-body"><h2>{data.users.length}</h2></div>
        </article>
        <article className="card stat-card warning">
          <div className="card-header">Total Fridge Items</div>
          <div className="card-body"><h2>{data.inventory.length}</h2></div>
        </article>
      </section>
    </main>
  );
}

async function AdminView(params: Search) {
  await requireRole(["admin"]);
  const data = readData();
  return (
    <main className="container medium stack">
      <section className="card">
        <div className="card-header">Create User</div>
        <div className="card-body">
          {alert(params)}
          <form action="/api/admin/users" method="POST">
            <input name="intent" type="hidden" value="create" />
            <div className="form-group">
              <label htmlFor="username">Username</label>
              <input className="form-control" id="username" name="username" required />
            </div>
            <div className="form-group">
              <label htmlFor="password">Password</label>
              <input className="form-control" id="password" name="password" type="password" required />
            </div>
            <div className="form-group">
              <label htmlFor="email">Email</label>
              <input className="form-control" id="email" name="email" type="email" required />
            </div>
            <div className="form-group">
              <label htmlFor="role">Role</label>
              <select className="form-control" id="role" name="role" required>
                {roles.filter((role) => role !== "provider").map((role) => (
                  <option key={role} value={role}>{role[0].toUpperCase() + role.slice(1)}</option>
                ))}
              </select>
            </div>
            <button className="btn btn-primary" type="submit">Create User</button>
          </form>
        </div>
      </section>
      <section className="card">
        <div className="card-header">Users</div>
        <div className="card-body table-wrap">
          <table>
            <thead>
              <tr>
                <th>Username</th>
                <th>Email</th>
                <th>Role</th>
                <th>Password</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {data.users.map((user) => (
                <tr key={user.id}>
                  <td>
                    <form id={`user-${user.id}`} action="/api/admin/users" method="POST">
                      <input name="intent" type="hidden" value="update" />
                      <input name="userId" type="hidden" value={user.id} />
                      <input className="form-control" name="username" defaultValue={user.username} required />
                    </form>
                  </td>
                  <td><input className="form-control" form={`user-${user.id}`} name="email" defaultValue={user.email} required type="email" /></td>
                  <td>
                    <select className="form-control" form={`user-${user.id}`} name="role" defaultValue={user.role} required>
                      {roles.filter((role) => role !== "provider").map((role) => (
                        <option key={role} value={role}>{role[0].toUpperCase() + role.slice(1)}</option>
                      ))}
                    </select>
                  </td>
                  <td><input className="form-control" form={`user-${user.id}`} name="password" type="password" /></td>
                  <td><button className="btn btn-primary" form={`user-${user.id}`} type="submit">Update</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}

async function FridgeView(params: Search) {
  const user = await requireRole(["manager", "chef", "admin"]);
  logAccess(user.id, "access_fridge");
  const data = readData();
  const orders = [...data.orders].sort((a, b) => new Date(b.orderDate).getTime() - new Date(a.orderDate).getTime());
  const usedItems = [...data.stockUsage].sort((a, b) => new Date(b.dateUsed).getTime() - new Date(a.dateUsed).getTime());
  return (
    <main className="container stack">
      {alert(params)}
      <section className="two-col">
        <article className="card">
          <div className="card-header light">Orders</div>
          <div className="card-body table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Order ID</th>
                  <th>Ordered By</th>
                  <th>Status</th>
                  <th>Delivery Date</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => (
                  <tr key={order.id}>
                    <td>{order.id}</td>
                    <td>{order.orderedBy}</td>
                    <td>{order.status}</td>
                    <td>{order.deliveryDate || ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>
        <article className="card">
          <div className="card-header light">Inventory</div>
          <div className="card-body stack">
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Item Name</th>
                    <th>Quantity</th>
                    <th>Expiry Date</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {data.inventory.map((item) => (
                    <tr key={item.id}>
                      <td>{item.itemName}{expiryIcon(item.expiryDate)}</td>
                      <td>{item.quantity}</td>
                      <td>{item.expiryDate}</td>
                      <td>
                        <div className="btn-row">
                          <form action="/api/fridge" method="POST">
                            <input name="intent" type="hidden" value="remove_item" />
                            <input name="itemId" type="hidden" value={item.id} />
                            <button className="btn btn-danger btn-sm" type="submit">X</button>
                          </form>
                          <form action="/api/fridge" className="inline-form" method="POST">
                            <input name="intent" type="hidden" value="use_item" />
                            <input name="itemId" type="hidden" value={item.id} />
                            <input className="form-control inline-input" min="1" max={item.quantity} name="quantityUsed" required type="number" />
                            <button className="btn btn-primary btn-sm" type="submit">Use</button>
                          </form>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <form action="/api/fridge" method="POST">
              <input name="intent" type="hidden" value="add_item" />
              <div className="form-group">
                <label htmlFor="itemName">Item Name</label>
                <input className="form-control" id="itemName" name="itemName" required />
              </div>
              <div className="form-group">
                <label htmlFor="quantity">Quantity</label>
                <input className="form-control" id="quantity" name="quantity" required type="number" />
              </div>
              <div className="form-group">
                <label htmlFor="expiryDate">Expiry Date</label>
                <input className="form-control" id="expiryDate" name="expiryDate" required type="date" />
              </div>
              <button className="btn btn-primary" type="submit">Add Item</button>
            </form>
          </div>
        </article>
      </section>
      <section className="card">
        <div className="card-header light">Used Items</div>
        <div className="card-body table-wrap">
          <table>
            <thead>
              <tr>
                <th>Item Name</th>
                <th>Quantity Used</th>
                <th>Date Used</th>
              </tr>
            </thead>
            <tbody>
              {usedItems.map((item) => (
                <tr key={item.id}>
                  <td>{item.itemName}</td>
                  <td>{item.quantityUsed}</td>
                  <td>{item.dateUsed}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <section className="card">
        <div className="card-header light">Add Compliance Report</div>
        <div className="card-body">
          <form action="/api/fridge" method="POST">
            <input name="intent" type="hidden" value="add_compliance_report" />
            <div className="form-group">
              <label htmlFor="complianceCheck">Compliance Check</label>
              <input className="form-control" id="complianceCheck" name="complianceCheck" required />
            </div>
            <div className="form-group">
              <label htmlFor="status">Status</label>
              <input className="form-control" id="status" name="status" required />
            </div>
            <div className="form-group">
              <label htmlFor="dateChecked">Date Checked</label>
              <input className="form-control" id="dateChecked" name="dateChecked" required type="date" />
            </div>
            <button className="btn btn-primary" type="submit">Add Compliance Report</button>
          </form>
        </div>
      </section>
    </main>
  );
}

async function TrackView(params: Search) {
  await requireRole(["chef", "provider", "admin", "delivery", "supplier", "manager"]);
  const data = readData();
  refreshOrderStatuses(data);
  writeData(data);
  const currentOrder = data.orders
    .filter((order) => order.status === "pending" || order.status === "delivering")
    .sort((a, b) => new Date(b.orderDate).getTime() - new Date(a.orderDate).getTime())[0];
  const orderItems = currentOrder
    ? data.orderItems
        .filter((item) => item.orderId === currentOrder.id)
        .map((item) => ({
          ...item,
          itemName: data.inventory.find((inventoryItem) => inventoryItem.id === item.itemId)?.itemName || "Unknown item"
        }))
    : [];
  const secondsLeft = currentOrder?.status === "pending" ? Math.max(0, 30 - Math.floor((Date.now() - new Date(currentOrder.orderDate).getTime()) / 1000)) : 0;
  return (
    <main className="container medium">
      <section className="card">
        <div className="card-header">Current Order</div>
        <div className="card-body stack">
          {alert(params)}
          {currentOrder ? (
            <>
              <div>
                <p>Order ID: {currentOrder.id}</p>
                <p>Order Date: {new Date(currentOrder.orderDate).toLocaleString()}</p>
                <p>Delivery Date: {currentOrder.deliveryDate || ""}</p>
                <p>Status: {currentOrder.status}</p>
                {currentOrder.status === "pending" ? <Countdown initialSeconds={secondsLeft} /> : null}
              </div>
              <details>
                <summary className="btn btn-info">Show Order Details</summary>
                <div className="small-stack">
                  <h3>Order Items</h3>
                  <ul>
                    {orderItems.map((item) => (
                      <li key={item.id}>{item.itemName} - {item.quantity}</li>
                    ))}
                  </ul>
                  <h3>Default Items</h3>
                  <ul>
                    {defaultOrderItems().map((item) => (
                      <li key={item.itemName}>{item.itemName} - {item.quantity}</li>
                    ))}
                  </ul>
                </div>
              </details>
              {currentOrder.status !== "delivering" ? (
                <form action="/api/track" method="POST">
                  <input name="intent" type="hidden" value="add_item" />
                  <div className="form-group">
                    <label htmlFor="itemName">Item Name</label>
                    <input className="form-control" id="itemName" name="itemName" required />
                  </div>
                  <div className="form-group">
                    <label htmlFor="quantity">Quantity</label>
                    <input className="form-control" id="quantity" name="quantity" required type="number" />
                  </div>
                  <button className="btn btn-primary" type="submit">Add Item</button>
                </form>
              ) : null}
              <form action="/api/track" method="POST">
                <input name="intent" type="hidden" value="cancel_order" />
                <button className="btn btn-danger" type="submit">Cancel Order</button>
              </form>
            </>
          ) : (
            <>
              <p>No current order.</p>
              <form action="/api/track" method="POST">
                <input name="intent" type="hidden" value="create_order" />
                <div className="form-group">
                  <label htmlFor="providerId">Delivery Provider</label>
                  <select className="form-control" id="providerId" name="providerId" required>
                    {data.deliveryProviders.map((provider) => (
                      <option key={provider.id} value={provider.id}>{provider.providerName}</option>
                    ))}
                  </select>
                </div>
                <button className="btn btn-primary" type="submit">Create New Order</button>
              </form>
            </>
          )}
        </div>
      </section>
    </main>
  );
}

async function ReportsView() {
  await requireRole(["manager", "chef", "admin"]);
  const data = readData();
  const stockUsage = [...data.stockUsage].sort((a, b) => new Date(b.dateUsed).getTime() - new Date(a.dateUsed).getTime());
  const complianceReports = [...data.complianceReports].sort((a, b) => new Date(b.dateChecked).getTime() - new Date(a.dateChecked).getTime());
  return (
    <main className="container stack">
      <h1>Health &amp; Safety Reports</h1>
      <section className="card">
        <div className="card-header light">Stock Usage Report</div>
        <div className="card-body table-wrap">
          <table>
            <thead>
              <tr>
                <th>Item Name</th>
                <th>Quantity Used</th>
                <th>Date Used</th>
              </tr>
            </thead>
            <tbody>
              {stockUsage.map((report) => (
                <tr key={report.id}>
                  <td>{report.itemName}</td>
                  <td>{report.quantityUsed}</td>
                  <td>{report.dateUsed}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <section className="card">
        <div className="card-header light">Compliance Report</div>
        <div className="card-body table-wrap">
          <table>
            <thead>
              <tr>
                <th>Compliance Check</th>
                <th>Status</th>
                <th>Date Checked</th>
              </tr>
            </thead>
            <tbody>
              {complianceReports.map((report) => (
                <tr key={report.id}>
                  <td>{report.complianceCheck}</td>
                  <td>{report.status}</td>
                  <td>{report.dateChecked}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}

async function SettingsView(params: Search) {
  const user = await requireUser();
  return (
    <main className="container narrow">
      <section className="card">
        <div className="card-header">Settings</div>
        <div className="card-body">
          {alert(params)}
          <form action="/api/settings" method="POST">
            <div className="form-group">
              <label htmlFor="username">Username</label>
              <input className="form-control" id="username" name="username" defaultValue={user.username} required />
            </div>
            <div className="form-group">
              <label htmlFor="password">New Password</label>
              <input className="form-control" id="password" name="password" type="password" />
            </div>
            <button className="btn btn-primary" type="submit">Update</button>
          </form>
        </div>
      </section>
    </main>
  );
}

function FAQView() {
  return (
    <main className="container medium stack">
      <h1>Frequently Asked Questions</h1>
      <section className="card faq-item">
        <details open>
          <summary>How do I register a new account?</summary>
          <p>To register a new account, click on the Sign Up link on the login page and fill in the required details.</p>
        </details>
      </section>
      <section className="card faq-item">
        <details>
          <summary>How do I reset my password?</summary>
          <p>To reset your password, contact an admin. Only admins can change user passwords and other details.</p>
        </details>
      </section>
    </main>
  );
}

function TermsView() {
  return (
    <main className="container medium">
      <h1>Terms of Service</h1>
      <p>Welcome to our Terms of Service page. Here you will find information about data protection and confidentiality.</p>
      <h2>Data Protection</h2>
      <p>We take data protection seriously and ensure that all user data is stored securely and handled with care.</p>
      <h2>Confidentiality</h2>
      <p>All users must respect the confidentiality of the company's information. Unauthorized access or sharing of confidential information is strictly prohibited.</p>
    </main>
  );
}

function UnauthorizedView() {
  return (
    <main className="container narrow">
      <section className="card">
        <div className="card-header">Unauthorized</div>
        <div className="card-body">
          <p>You do not have permission to access this page.</p>
          <Link className="btn btn-primary" href="/dashboard">Back to Dashboard</Link>
        </div>
      </section>
    </main>
  );
}

export default async function Page({ params, searchParams }: PageProps) {
  const route = (await params).page?.join("/") || "";
  const query = await searchParams;
  if (route === "") {
    return <HomeView />;
  }
  if (route === "login") {
    return LoginView(query);
  }
  if (route === "signup") {
    return <SignupView {...query} />;
  }
  if (route === "dashboard") {
    return DashboardView();
  }
  if (route === "admin") {
    return AdminView(query);
  }
  if (route === "fridge") {
    return FridgeView(query);
  }
  if (route === "track") {
    return TrackView(query);
  }
  if (route === "reports") {
    return ReportsView();
  }
  if (route === "settings") {
    return SettingsView(query);
  }
  if (route === "faq") {
    return <FAQView />;
  }
  if (route === "tos") {
    return <TermsView />;
  }
  if (route === "unauthorized") {
    return <UnauthorizedView />;
  }
  redirect("/");
}
