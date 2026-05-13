# Future Fridge

Future Fridge is a smart kitchen operations app for managing fridge stock, supplier orders, user access, and health and safety records from one place.

## Features

| Feature | Description |
| --- | --- |
| User authentication | Login, signup, logout, session handling, and role-based navigation. |
| Admin user management | Create users, update account details, change roles, and reset passwords. |
| Dashboard | View total orders, successful deliveries, users, and fridge inventory counts. |
| Inventory management | Add fridge items, remove items, track quantities, and flag expiring or expired stock. |
| Stock usage tracking | Record item usage and keep a usage history for kitchen reporting. |
| Order tracking | Create supplier orders, add order items, cancel orders, and follow pending or delivering status. |
| Compliance reports | Add and review health and safety compliance checks. |
| Reports | View stock usage and compliance records in report tables. |
| Local database storage | Store app data in a local SQLite database without running a database server. |

## Run

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

Seeded users:

| Username | Password | Role |
| --- | --- | --- |
| admin | admin | admin |
| manager | password | manager |
| chef | password | chef |
| delivery | password | delivery |
| supplier | password | supplier |

The app stores local development data in `.data/future_fridge.sqlite`, a SQLite database file that does not need a database server.

For production, set `AUTH_SECRET` to a long random value before starting the app.
